import axios from "axios";
import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildChannelConfigSchema,
  type MoltbotConfig,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";
import type {
  DingTalkConfig,
  TokenInfo,
  DingTalkInboundMessage,
  MessageContent,
  SendMessageOptions,
  MediaFile,
  HandleDingTalkMessageParams,
  ProactiveMessagePayload,
  SessionWebhookResponse,
  Logger,
  GatewayStartContext,
  GatewayStopResult,
  InteractiveCardData,
  InteractiveCardSendRequest,
  InteractiveCardUpdateRequest,
  CardInstance,
  ResolvedAccount,
} from "./types.js";
import { DingTalkConfigSchema } from "./config-schema.js";
import { getDingTalkRuntime } from "./runtime.js";
import { maskSensitiveData, cleanupOrphanedTempFiles, retryWithBackoff } from "./utils.js";

// Build config schema
export const dingtalkConfigSchema = buildChannelConfigSchema(DingTalkConfigSchema);

// Access Token cache
let accessToken: string | null = null;
let accessTokenExpiry = 0;

// Card instance cache for streaming updates
const cardInstances = new Map<string, CardInstance>();

type SessionWebhookCacheEntry = {
  sessionWebhook: string;
  senderId?: string;
  isDirect: boolean;
  expiresAt: number;
  lastSeenAt: number;
};

// sessionWebhook cache (Stream mode): (accountId + to) -> sessionWebhook
// Note: in-memory only, never persisted, to avoid sensitive data leakage.
const sessionWebhookCache = new Map<string, SessionWebhookCacheEntry>();

// Card update throttling
const cardUpdateTimestamps = new Map<string, number>();
const _CARD_UPDATE_MIN_INTERVAL = 500;

// Card update timeout tracking
const cardUpdateTimeouts = new Map<string, NodeJS.Timeout>();
const _CARD_UPDATE_TIMEOUT = 60000;

// Card cache TTL (1 hour)
const CARD_CACHE_TTL = 60 * 60 * 1000;

// Cleanup interval
let cleanupIntervalId: NodeJS.Timeout | null = null;

// Clean up old card instances from cache
function cleanupCardCache() {
  const now = Date.now();
  for (const [cardBizId, instance] of cardInstances.entries()) {
    if (now - instance.lastUpdated > CARD_CACHE_TTL) {
      cardInstances.delete(cardBizId);
      cardUpdateTimestamps.delete(cardBizId);
      const timeout = cardUpdateTimeouts.get(cardBizId);
      if (timeout) {
        clearTimeout(timeout);
        cardUpdateTimeouts.delete(cardBizId);
      }
    }
  }
}

function resolveSessionWebhookCacheKey(params: { accountId?: string; to: string }): string {
  return `${params.accountId ?? "default"}:${params.to}`;
}

function cleanupSessionWebhookCache() {
  const now = Date.now();
  for (const [key, entry] of sessionWebhookCache.entries()) {
    if (now >= entry.expiresAt) {
      sessionWebhookCache.delete(key);
    }
  }
}

function cacheSessionWebhook(params: {
  accountId?: string;
  to: string;
  sessionWebhook?: string;
  senderId?: string;
  isDirect: boolean;
  ttlMs?: number;
}) {
  const { accountId, to, sessionWebhook, senderId, isDirect } = params;
  if (!sessionWebhook) {
    return;
  }

  const ttlCandidate = params.ttlMs;
  const ttlMs =
    typeof ttlCandidate === "number" && Number.isFinite(ttlCandidate) && ttlCandidate >= 0
      ? ttlCandidate
      : 6 * 60 * 60 * 1000;
  if (ttlMs === 0) {
    return;
  }

  const now = Date.now();
  sessionWebhookCache.set(resolveSessionWebhookCacheKey({ accountId, to }), {
    sessionWebhook,
    senderId,
    isDirect,
    expiresAt: now + ttlMs,
    lastSeenAt: now,
  });
}

function getCachedSessionWebhook(params: {
  accountId?: string;
  to: string;
}): SessionWebhookCacheEntry | undefined {
  const key = resolveSessionWebhookCacheKey(params);
  const entry = sessionWebhookCache.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() >= entry.expiresAt) {
    sessionWebhookCache.delete(key);
    return undefined;
  }
  return entry;
}

function startCardCacheCleanup() {
  if (!cleanupIntervalId) {
    cleanupIntervalId = setInterval(
      () => {
        cleanupCardCache();
        cleanupSessionWebhookCache();
      },
      30 * 60 * 1000,
    );
  }
}

function stopCardCacheCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  for (const timeout of cardUpdateTimeouts.values()) {
    clearTimeout(timeout);
  }
  cardUpdateTimeouts.clear();
}

// Helper function to detect markdown and extract title
function detectMarkdownAndExtractTitle(
  text: string,
  options: SendMessageOptions,
  defaultTitle: string,
): { useMarkdown: boolean; title: string } {
  const hasMarkdown = /^[#*>-]|[*_`#[\]]/.test(text) || text.includes("\n");
  const useMarkdown = options.useMarkdown !== false && (options.useMarkdown || hasMarkdown);

  const title =
    options.title ||
    (useMarkdown
      ? text
          .split("\n")[0]
          .replace(/^[#*\s\->]+/, "")
          .slice(0, 20) || defaultTitle
      : defaultTitle);

  return { useMarkdown, title };
}

function getConfig(cfg: MoltbotConfig, accountId?: string): DingTalkConfig {
  const dingtalkCfg = (cfg?.channels as Record<string, unknown>)?.dingtalk as
    | DingTalkConfig
    | undefined;
  if (!dingtalkCfg) {
    return {} as DingTalkConfig;
  }

  if (accountId && dingtalkCfg.accounts?.[accountId]) {
    return dingtalkCfg.accounts[accountId];
  }

  return dingtalkCfg;
}

function isConfigured(cfg: MoltbotConfig, accountId?: string): boolean {
  const config = getConfig(cfg, accountId);
  return Boolean(config.clientId && config.clientSecret);
}

// Get Access Token with retry logic
export async function getAccessToken(config: DingTalkConfig, log?: Logger): Promise<string> {
  const now = Date.now();
  if (accessToken && accessTokenExpiry > now + 60000) {
    return accessToken;
  }

  const token = await retryWithBackoff(
    async () => {
      const response = await axios.post<TokenInfo>(
        "https://api.dingtalk.com/v1.0/oauth2/accessToken",
        {
          appKey: config.clientId,
          appSecret: config.clientSecret,
        },
      );

      accessToken = response.data.accessToken;
      accessTokenExpiry = now + response.data.expireIn * 1000;
      return accessToken;
    },
    { maxRetries: 3, log },
  );

  return token;
}

// Download media file
async function downloadMedia(
  config: DingTalkConfig,
  downloadCode: string,
  log?: Logger,
): Promise<MediaFile | null> {
  if (!config.robotCode) {
    log?.error?.("[DingTalk] downloadMedia requires robotCode to be configured.");
    return null;
  }
  try {
    const token = await getAccessToken(config, log);
    const response = await axios.post<{ downloadUrl?: string }>(
      "https://api.dingtalk.com/v1.0/robot/messageFiles/download",
      { downloadCode, robotCode: config.robotCode },
      { headers: { "x-acs-dingtalk-access-token": token } },
    );
    const downloadUrl = response.data?.downloadUrl;
    if (!downloadUrl) {
      return null;
    }
    const mediaResponse = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    const contentType =
      (mediaResponse.headers["content-type"] as string) || "application/octet-stream";
    const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
    const tempPath = path.join(os.tmpdir(), `dingtalk_${Date.now()}.${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(mediaResponse.data as ArrayBuffer));
    return { path: tempPath, mimeType: contentType };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error?.(`[DingTalk] Failed to download media: ${errMsg}`);
    return null;
  }
}

function extractMessageContent(data: DingTalkInboundMessage): MessageContent {
  const msgtype = data.msgtype || "text";

  if (msgtype === "text") {
    return { text: data.text?.content?.trim() || "", messageType: "text" };
  }

  if (msgtype === "richText") {
    const richTextParts = data.content?.richText || [];
    let text = "";
    for (const part of richTextParts) {
      if (part.type === "text" && part.text) {
        text += part.text;
      }
      if (part.type === "at" && part.atName) {
        text += `@${part.atName} `;
      }
    }
    return { text: text.trim() || "[富文本消息]", messageType: "richText" };
  }

  if (msgtype === "picture") {
    return {
      text: "[图片]",
      mediaPath: data.content?.downloadCode,
      mediaType: "image",
      messageType: "picture",
    };
  }

  if (msgtype === "audio") {
    return {
      text: data.content?.recognition || "[语音消息]",
      mediaPath: data.content?.downloadCode,
      mediaType: "audio",
      messageType: "audio",
    };
  }

  if (msgtype === "video") {
    return {
      text: "[视频]",
      mediaPath: data.content?.downloadCode,
      mediaType: "video",
      messageType: "video",
    };
  }

  if (msgtype === "file") {
    return {
      text: `[文件: ${data.content?.fileName || "文件"}]`,
      mediaPath: data.content?.downloadCode,
      mediaType: "file",
      messageType: "file",
    };
  }

  return { text: data.text?.content?.trim() || `[${msgtype}消息]`, messageType: msgtype };
}

// Send proactive message via DingTalk OpenAPI
export async function sendProactiveMessage(
  config: DingTalkConfig,
  target: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<unknown> {
  const token = await getAccessToken(config, options.log);
  const isGroup = target.startsWith("cid");

  const url = isGroup
    ? "https://api.dingtalk.com/v1.0/robot/groupMessages/send"
    : "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend";

  const { useMarkdown, title } = detectMarkdownAndExtractTitle(text, options, "Moltbot 提醒");
  const msgKey = useMarkdown ? "sampleMarkdown" : "sampleText";

  // sampleMarkdown 需要 { title, text }，sampleText 需要 { content }
  const msgParam = useMarkdown
    ? JSON.stringify({ title, text })
    : JSON.stringify({ content: text });

  const payload: ProactiveMessagePayload = {
    robotCode: config.robotCode || config.clientId,
    msgKey,
    msgParam,
  };

  if (isGroup) {
    payload.openConversationId = target;
  } else {
    payload.userIds = [target];
  }

  const result = await axios({
    url,
    method: "POST",
    data: payload,
    headers: { "x-acs-dingtalk-access-token": token, "Content-Type": "application/json" },
  });
  return result.data;
}

// Send message via sessionWebhook
export async function sendBySession(
  config: DingTalkConfig,
  sessionWebhook: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<unknown> {
  const token = await getAccessToken(config, options.log);
  const { useMarkdown, title } = detectMarkdownAndExtractTitle(text, options, "Moltbot 消息");

  let body: SessionWebhookResponse;
  if (useMarkdown) {
    let finalText = text;
    if (options.atUserId) {
      finalText = `${finalText} @${options.atUserId}`;
    }
    body = { msgtype: "markdown", markdown: { title, text: finalText } };
  } else {
    body = { msgtype: "text", text: { content: text } };
  }

  if (options.atUserId) {
    body.at = { atUserIds: [options.atUserId], isAtAll: false };
  }

  const result = await axios({
    url: sessionWebhook,
    method: "POST",
    data: body,
    headers: { "x-acs-dingtalk-access-token": token, "Content-Type": "application/json" },
  });
  return result.data;
}

// Send interactive card
export async function sendInteractiveCard(
  config: DingTalkConfig,
  conversationId: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<{ cardBizId: string; response: unknown }> {
  const robotCode = config.robotCode || config.clientId;
  if (!robotCode) {
    throw new Error("[DingTalk] robotCode or clientId is required for sending interactive cards");
  }

  const token = await getAccessToken(config, options.log);
  const isGroup = conversationId.startsWith("cid");
  const cardBizId = `card_${randomUUID()}`;
  const { useMarkdown, title } = detectMarkdownAndExtractTitle(text, options, "Moltbot 消息");

  const cardData: InteractiveCardData = {
    config: { autoLayout: true, enableForward: true },
    header: { title: { type: "text", text: title } },
    contents: [{ type: useMarkdown ? "markdown" : "text", text }],
  };

  const payload: InteractiveCardSendRequest = {
    cardTemplateId: config.cardTemplateId || "StandardCard",
    cardBizId,
    robotCode,
    cardData: JSON.stringify(cardData),
  };

  if (isGroup) {
    payload.openConversationId = conversationId;
  } else {
    payload.singleChatReceiver = JSON.stringify({ userId: conversationId });
  }

  const apiUrl =
    config.cardSendApiUrl || "https://api.dingtalk.com/v1.0/im/v1.0/robot/interactiveCards/send";

  const result = await retryWithBackoff(
    async () => {
      return await axios({
        url: apiUrl,
        method: "POST",
        data: payload,
        headers: { "x-acs-dingtalk-access-token": token, "Content-Type": "application/json" },
      });
    },
    { maxRetries: 3, log: options.log },
  );

  cardInstances.set(cardBizId, {
    cardBizId,
    conversationId,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  });

  return { cardBizId, response: result.data };
}

// Update existing interactive card
export async function updateInteractiveCard(
  config: DingTalkConfig,
  cardBizId: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<unknown> {
  const token = await getAccessToken(config, options.log);
  const { useMarkdown, title } = detectMarkdownAndExtractTitle(text, options, "Moltbot 消息");

  const cardData: InteractiveCardData = {
    config: { autoLayout: true, enableForward: true },
    header: { title: { type: "text", text: title } },
    contents: [{ type: useMarkdown ? "markdown" : "text", text }],
  };

  const payload: InteractiveCardUpdateRequest = {
    cardBizId,
    cardData: JSON.stringify(cardData),
    updateOptions: { updateCardDataByKey: false },
  };

  const apiUrl =
    config.cardUpdateApiUrl || "https://api.dingtalk.com/v1.0/im/robots/interactiveCards";

  try {
    const result = await retryWithBackoff(
      async () => {
        return await axios({
          url: apiUrl,
          method: "PUT",
          data: payload,
          headers: { "x-acs-dingtalk-access-token": token, "Content-Type": "application/json" },
        });
      },
      { maxRetries: 3, log: options.log },
    );

    const instance = cardInstances.get(cardBizId);
    if (instance) {
      instance.lastUpdated = Date.now();
    }

    return result.data;
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    const statusCode = error.response?.status;
    if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
      options.log?.debug?.(
        `[DingTalk] Removing card ${cardBizId} from cache due to error ${statusCode}`,
      );
      cardInstances.delete(cardBizId);
    }
    throw err;
  }
}

// Authorization helpers
type NormalizedAllowFrom = {
  entries: string[];
  entriesLower: string[];
  hasWildcard: boolean;
  hasEntries: boolean;
};

function normalizeAllowFrom(list?: string[]): NormalizedAllowFrom {
  const entries = (list ?? []).map((value) => String(value).trim()).filter(Boolean);
  const hasWildcard = entries.includes("*");
  const normalized = entries
    .filter((value) => value !== "*")
    .map((value) => value.replace(/^(dingtalk|dd|ding):/i, ""));
  const normalizedLower = normalized.map((value) => value.toLowerCase());
  return {
    entries: normalized,
    entriesLower: normalizedLower,
    hasWildcard,
    hasEntries: entries.length > 0,
  };
}

function isSenderAllowed(params: { allow: NormalizedAllowFrom; senderId?: string }): boolean {
  const { allow, senderId } = params;
  if (!allow.hasEntries) {
    return true;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (senderId && allow.entriesLower.includes(senderId.toLowerCase())) {
    return true;
  }
  return false;
}

// Message handler
async function handleDingTalkMessage(params: HandleDingTalkMessageParams): Promise<void> {
  const { cfg, accountId, data, sessionWebhook, log, dingtalkConfig } = params;
  const rt = getDingTalkRuntime();

  log?.debug?.("[DingTalk] Full Inbound Data:", JSON.stringify(maskSensitiveData(data)));

  // Filter robot self-messages
  if (data.senderId === data.chatbotUserId || data.senderStaffId === data.chatbotUserId) {
    log?.debug?.("[DingTalk] Ignoring robot self-message");
    return;
  }

  const content = extractMessageContent(data);
  if (!content.text) {
    return;
  }

  const isDirect = data.conversationType === "1";
  const senderId = data.senderStaffId || data.senderId;
  const senderName = data.senderNick || "Unknown";
  const groupId = data.conversationId;
  const groupName = data.conversationTitle || "Group";

  // Check authorization for direct messages
  let commandAuthorized = true;
  if (isDirect) {
    const dmPolicy = dingtalkConfig.dmPolicy || "open";
    const allowFrom = dingtalkConfig.allowFrom || [];

    if (dmPolicy === "allowlist") {
      const normalizedAllowFrom = normalizeAllowFrom(allowFrom);
      const isAllowed = isSenderAllowed({ allow: normalizedAllowFrom, senderId });

      if (!isAllowed) {
        log?.debug?.(`[DingTalk] DM blocked: senderId=${senderId} not in allowlist`);
        try {
          await sendBySession(
            dingtalkConfig,
            sessionWebhook,
            `⛔ 访问受限\n\n您的用户ID：\`${senderId}\`\n\n请联系管理员将此ID添加到允许列表中。`,
            { log },
          );
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log?.debug?.(`[DingTalk] Failed to send access denied message: ${errMsg}`);
        }
        return;
      }
    }
  }

  let mediaPath: string | undefined;
  let mediaType: string | undefined;
  if (content.mediaPath && dingtalkConfig.robotCode) {
    const media = await downloadMedia(dingtalkConfig, content.mediaPath, log);
    if (media) {
      mediaPath = media.path;
      mediaType = media.mimeType;
    }
  }

  const route = rt.channel.routing.resolveAgentRoute({
    cfg,
    channel: "dingtalk",
    accountId,
    peer: { kind: isDirect ? "dm" : "group", id: isDirect ? senderId : groupId },
  });

  const storePath = rt.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = rt.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = rt.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const fromLabel = isDirect ? `${senderName} (${senderId})` : `${groupName} - ${senderName}`;
  const body = rt.channel.reply.formatInboundEnvelope({
    channel: "DingTalk",
    from: fromLabel,
    timestamp: data.createAt,
    body: content.text,
    chatType: isDirect ? "direct" : "group",
    sender: { name: senderName, id: senderId },
    previousTimestamp,
    envelope: envelopeOptions,
  });

  const to = isDirect ? senderId : groupId;

  // Cache sessionWebhook for best-effort outbound fallback (used by async announces, etc.)
  cacheSessionWebhook({
    accountId,
    to,
    sessionWebhook,
    senderId,
    isDirect,
    ttlMs: dingtalkConfig.sessionWebhookCacheTtlMs,
  });

  const ctx = rt.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: content.text,
    CommandBody: content.text,
    From: to,
    To: to,
    SessionKey: route.sessionKey,
    AccountId: accountId,
    ChatType: isDirect ? "direct" : "group",
    ConversationLabel: fromLabel,
    GroupSubject: isDirect ? undefined : groupName,
    SenderName: senderName,
    SenderId: senderId,
    Provider: "dingtalk",
    Surface: "dingtalk",
    MessageSid: data.msgId,
    Timestamp: data.createAt,
    MediaPath: mediaPath,
    MediaType: mediaType,
    MediaUrl: mediaPath,
    CommandAuthorized: commandAuthorized,
    OriginatingChannel: "dingtalk",
    OriginatingTo: to,
  });

  await rt.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctx.SessionKey || route.sessionKey,
    ctx,
    updateLastRoute: { sessionKey: route.mainSessionKey, channel: "dingtalk", to, accountId },
  });

  log?.info?.(`[DingTalk] Inbound: from=${senderName} text="${content.text.slice(0, 50)}..."`);

  // Feedback: Thinking...
  let currentCardBizId: string | undefined;
  const useCardMode = dingtalkConfig.messageType === "card";

  if (dingtalkConfig.showThinking !== false) {
    try {
      if (useCardMode) {
        const result = await sendInteractiveCard(dingtalkConfig, to, "🤔 思考中，请稍候...", {
          log,
        });
        currentCardBizId = result.cardBizId;
      } else {
        await sendBySession(dingtalkConfig, sessionWebhook, "🤔 思考中，请稍候...", {
          atUserId: !isDirect ? senderId : null,
          log,
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log?.debug?.(`[DingTalk] Thinking message failed: ${errMsg}`);
    }
  }

  const { dispatcher, replyOptions, markDispatchIdle } =
    rt.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: "",
      deliver: async (payload: { markdown?: string; text?: string }) => {
        try {
          const textToSend = payload.markdown || payload.text;
          if (!textToSend) {
            return { ok: true };
          }

          if (useCardMode) {
            if (currentCardBizId) {
              await updateInteractiveCard(dingtalkConfig, currentCardBizId, textToSend, { log });
            } else {
              const result = await sendInteractiveCard(dingtalkConfig, to, textToSend, { log });
              currentCardBizId = result.cardBizId;
            }
          } else {
            await sendBySession(dingtalkConfig, sessionWebhook, textToSend, {
              atUserId: !isDirect ? senderId : null,
              log,
            });
          }
          return { ok: true };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log?.error?.(`[DingTalk] Reply failed: ${errMsg}`);
          return { ok: false, error: errMsg };
        }
      },
    });

  try {
    await rt.channel.reply.dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyOptions });
  } finally {
    markDispatchIdle();
    if (mediaPath && fs.existsSync(mediaPath)) {
      try {
        fs.unlinkSync(mediaPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// DingTalk Channel Plugin Definition
export const dingtalkPlugin: ChannelPlugin<ResolvedAccount> = {
  id: "dingtalk",
  meta: {
    id: "dingtalk",
    label: "DingTalk",
    selectionLabel: "DingTalk (钉钉)",
    docsPath: "/channels/dingtalk",
    blurb: "钉钉企业内部机器人，使用 Stream 模式，无需公网 IP。",
    aliases: ["dd", "ding"],
  },
  configSchema: dingtalkConfigSchema,
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  config: {
    listAccountIds: (cfg: MoltbotConfig): string[] => {
      const config = getConfig(cfg);
      return config.accounts ? Object.keys(config.accounts) : isConfigured(cfg) ? ["default"] : [];
    },
    resolveAccount: (cfg: MoltbotConfig, accountId?: string) => {
      const config = getConfig(cfg);
      const id = accountId || "default";
      const account = config.accounts?.[id];
      return account
        ? { accountId: id, config: account, enabled: account.enabled !== false }
        : { accountId: "default", config, enabled: config.enabled !== false };
    },
    defaultAccountId: (): string => "default",
    isConfigured: (account: ResolvedAccount): boolean =>
      Boolean(account.config?.clientId && account.config?.clientSecret),
    describeAccount: (account: ResolvedAccount) => ({
      accountId: account.accountId,
      name: account.config?.name || "DingTalk",
      enabled: account.enabled,
      configured: Boolean(account.config?.clientId),
    }),
  },
  security: {
    resolveDmPolicy: ({ account }: { account: ResolvedAccount }) => ({
      policy: account.config?.dmPolicy || "open",
      allowFrom: account.config?.allowFrom || [],
      policyPath: "channels.dingtalk.dmPolicy",
      allowFromPath: "channels.dingtalk.allowFrom",
      approveHint: "使用 /allow dingtalk:<userId> 批准用户",
      normalizeEntry: (raw: string) => raw.replace(/^(dingtalk|dd|ding):/i, ""),
    }),
  },
  groups: {
    resolveRequireMention: ({ cfg }: { cfg: MoltbotConfig }): boolean =>
      getConfig(cfg).groupPolicy !== "open",
  },
  messaging: {
    normalizeTarget: ({ target }: { target?: string }) =>
      target ? { targetId: target.replace(/^(dingtalk|dd|ding):/i, "") } : null,
    targetResolver: {
      looksLikeId: (id: string): boolean => /^[\w-]+$/.test(id),
      hint: "<conversationId>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    resolveTarget: ({ to }: { to?: string | null }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return { ok: false, error: new Error("DingTalk message requires --to <conversationId>") };
      }
      return { ok: true, to: trimmed };
    },
    sendText: async ({
      cfg,
      to,
      text,
      accountId,
      log,
    }: {
      cfg: MoltbotConfig;
      to: string;
      text: string;
      accountId?: string;
      log?: Logger;
    }) => {
      const config = getConfig(cfg, accountId);
      try {
        const result = await sendProactiveMessage(config, to, text, { log });
        return { ok: true, data: result };
      } catch (err: unknown) {
        const proactiveError = err as { response?: { data?: unknown }; message?: string };
        const proactiveErrorPayload = proactiveError.response?.data || proactiveError.message;

        if (config.outboundFallbackToSessionWebhook !== false) {
          const cached = getCachedSessionWebhook({ accountId, to });
          if (cached) {
            try {
              const atUserId =
                config.mentionSenderInGroupFallback !== false && !cached.isDirect
                  ? (cached.senderId ?? null)
                  : null;
              const result = await sendBySession(config, cached.sessionWebhook, text, {
                atUserId,
                log,
              });
              log?.debug?.(
                "[DingTalk] Proactive send failed; delivered via sessionWebhook fallback",
              );
              return { ok: true, data: result };
            } catch (fallbackErr: unknown) {
              const fallbackError = fallbackErr as {
                response?: { data?: unknown };
                message?: string;
              };
              return {
                ok: false,
                error: {
                  proactive: proactiveErrorPayload,
                  fallback: fallbackError.response?.data || fallbackError.message,
                },
              };
            }
          }
        }

        return { ok: false, error: proactiveErrorPayload };
      }
    },
    sendMedia: async ({
      cfg,
      to,
      mediaPath,
      accountId,
      log,
    }: {
      cfg: MoltbotConfig;
      to: string;
      mediaPath: string;
      accountId?: string;
      log?: Logger;
    }) => {
      const config = getConfig(cfg, accountId);
      if (!config.clientId) {
        return { ok: false, error: "DingTalk not configured" };
      }
      try {
        const mediaDescription = `[媒体消息: ${mediaPath}]`;
        const result = await sendProactiveMessage(config, to, mediaDescription, { log });
        return { ok: true, data: result };
      } catch (err: unknown) {
        const proactiveError = err as { response?: { data?: unknown }; message?: string };
        const proactiveErrorPayload = proactiveError.response?.data || proactiveError.message;

        if (config.outboundFallbackToSessionWebhook !== false) {
          const cached = getCachedSessionWebhook({ accountId, to });
          if (cached) {
            try {
              const atUserId =
                config.mentionSenderInGroupFallback !== false && !cached.isDirect
                  ? (cached.senderId ?? null)
                  : null;
              const result = await sendBySession(
                config,
                cached.sessionWebhook,
                `[媒体消息]

${mediaPath}`,
                {
                  atUserId,
                  log,
                },
              );
              log?.debug?.(
                "[DingTalk] Proactive media send failed; delivered via sessionWebhook fallback",
              );
              return { ok: true, data: result };
            } catch (fallbackErr: unknown) {
              const fallbackError = fallbackErr as {
                response?: { data?: unknown };
                message?: string;
              };
              return {
                ok: false,
                error: {
                  proactive: proactiveErrorPayload,
                  fallback: fallbackError.response?.data || fallbackError.message,
                },
              };
            }
          }
        }

        return { ok: false, error: proactiveErrorPayload };
      }
    },
  },
  gateway: {
    startAccount: async (ctx: GatewayStartContext): Promise<GatewayStopResult> => {
      const { account, cfg, abortSignal } = ctx;
      const config = account.config;
      if (!config.clientId || !config.clientSecret) {
        throw new Error("DingTalk clientId and clientSecret are required");
      }
      ctx.log?.info?.(`[${account.accountId}] Starting DingTalk Stream client...`);

      cleanupOrphanedTempFiles(ctx.log);
      startCardCacheCleanup();

      const client = new DWClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        debug: config.debug || false,
      });

      client.registerCallbackListener(
        TOPIC_ROBOT,
        async (res: { headers?: { messageId?: string }; data: string }) => {
          // 调试日志：回调被触发
          ctx.log?.info?.(`[DingTalk] ========== CALLBACK RECEIVED ==========`);
          ctx.log?.info?.(`[DingTalk] Raw response headers: ${JSON.stringify(res.headers)}`);
          ctx.log?.info?.(`[DingTalk] Raw response data: ${res.data?.substring(0, 500)}`);
          console.log("[DingTalk] ========== CALLBACK RECEIVED ==========");
          console.log("[DingTalk] Raw data:", res.data?.substring(0, 500));

          const messageId = res.headers?.messageId;
          try {
            if (messageId) {
              client.socketCallBackResponse(messageId, { success: true });
            }
            const data = JSON.parse(res.data) as DingTalkInboundMessage;
            await handleDingTalkMessage({
              cfg,
              accountId: account.accountId,
              data,
              sessionWebhook: data.sessionWebhook,
              log: ctx.log,
              dingtalkConfig: config,
            });
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            ctx.log?.error?.(`[DingTalk] Error processing message: ${errMsg}`);
          }
        },
      );

      await client.connect();
      ctx.log?.info?.(`[${account.accountId}] DingTalk Stream client connected`);

      const rt = getDingTalkRuntime();
      rt.channel.activity.record("dingtalk", account.accountId, "start");

      let stopped = false;
      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          if (stopped) {
            return;
          }
          stopped = true;
          ctx.log?.info?.(`[${account.accountId}] Stopping DingTalk Stream client...`);
          rt.channel.activity.record("dingtalk", account.accountId, "stop");
        });
      }

      return {
        stop: () => {
          if (stopped) {
            return;
          }
          stopped = true;
          ctx.log?.info?.(`[${account.accountId}] DingTalk provider stopped`);
          rt.channel.activity.record("dingtalk", account.accountId, "stop");
          stopCardCacheCleanup();
        },
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    probe: async ({ cfg }: { cfg: MoltbotConfig }) => {
      if (!isConfigured(cfg)) {
        return { ok: false, error: "Not configured" };
      }
      try {
        const config = getConfig(cfg);
        await getAccessToken(config);
        return { ok: true, details: { clientId: config.clientId } };
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return { ok: false, error: errMsg };
      }
    },
    buildChannelSummary: ({
      snapshot,
    }: {
      snapshot?: {
        configured?: boolean;
        running?: boolean;
        lastStartAt?: number | null;
        lastStopAt?: number | null;
        lastError?: string | null;
      };
    }) => ({
      configured: snapshot?.configured ?? false,
      running: snapshot?.running ?? false,
      lastStartAt: snapshot?.lastStartAt ?? null,
      lastStopAt: snapshot?.lastStopAt ?? null,
      lastError: snapshot?.lastError ?? null,
    }),
  },
};
