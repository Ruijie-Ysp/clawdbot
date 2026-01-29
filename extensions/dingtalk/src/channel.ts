import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  getChatChannelMeta,
  type ChannelPlugin,
  type ClawdbotConfig,
} from "clawdbot/plugin-sdk";

import { DingTalkConfigSchema } from "./config-schema.js";
import { dingtalkOnboardingAdapter } from "./onboarding.js";
import { sendDingTalkMessage } from "./send.js";
import type { ResolvedDingTalkAccount } from "./types.js";

const meta = getChatChannelMeta("dingtalk");

function normalizeDingTalkMessagingTarget(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  
  // 钉钉目标格式：user:userId 或 chat:chatId
  if (trimmed.startsWith("user:") || trimmed.startsWith("chat:")) {
    return trimmed;
  }
  
  // 检查是否是用户ID格式
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return `user:${trimmed}`;
  }
  
  // 检查是否是会话ID格式
  if (trimmed.includes("chat") || trimmed.includes("conversation")) {
    return `chat:${trimmed}`;
  }
  
  // 默认为用户
  return `user:${trimmed}`;
}

function resolveDingTalkAccount(
  cfg: ClawdbotConfig,
  accountId: string = DEFAULT_ACCOUNT_ID
): ResolvedDingTalkAccount {
  const config = cfg.channels?.dingtalk;
  return {
    accountId,
    enabled: config?.enabled !== false,
    configured: Boolean(config?.webhookUrl),
    webhookUrl: config?.webhookUrl,
    secret: config?.secret,
    callbackPath: config?.callbackPath,
    dmPolicy: config?.dmPolicy,
    allowFrom: config?.allowFrom,
    groupPolicy: config?.groupPolicy,
    groupAllowFrom: config?.groupAllowFrom,
  };
}

function listDingTalkAccountIds(cfg: ClawdbotConfig): string[] {
  return [DEFAULT_ACCOUNT_ID];
}

export const dingtalkPlugin: ChannelPlugin<ResolvedDingTalkAccount> = {
  id: "dingtalk",
  meta: {
    ...meta,
    showConfigured: true,
    quickstartAllowFrom: true,
  },
  onboarding: dingtalkOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    atMembers: true,
    markdown: true,
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: buildChannelConfigSchema(DingTalkConfigSchema),
  config: {
    listAccountIds: (cfg) => listDingTalkAccountIds(cfg as ClawdbotConfig),
    resolveAccount: (cfg, accountId) => resolveDingTalkAccount(cfg as ClawdbotConfig, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const config = { ...cfg } as ClawdbotConfig;
      if (!config.channels) {
        config.channels = {};
      }
      if (!config.channels.dingtalk) {
        config.channels.dingtalk = {};
      }
      config.channels.dingtalk.enabled = enabled;
      return config;
    },
    deleteAccount: ({ cfg }) => {
      const config = { ...cfg } as ClawdbotConfig;
      if (config.channels?.dingtalk) {
        delete config.channels.dingtalk;
        if (Object.keys(config.channels).length === 0) {
          delete config.channels;
        }
      }
      return config;
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      webhookConfigured: Boolean(account.webhookUrl),
    }),
    resolveAllowFrom: ({ cfg }) => {
      const config = (cfg as ClawdbotConfig).channels?.dingtalk;
      return config?.allowFrom?.map(String) ?? [];
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => {
          // 标准化用户ID格式
          if (!entry.startsWith("user:")) {
            return `user:${entry}`;
          }
          return entry;
        }),
  },
  security: {
    resolveDmPolicy: ({ cfg }) => {
      const config = (cfg as ClawdbotConfig).channels?.dingtalk;
      return {
        policy: config?.dmPolicy ?? "open",
        allowFrom: config?.allowFrom ?? [],
        policyPath: "channels.dingtalk.dmPolicy",
        allowFromPath: "channels.dingtalk.allowFrom",
        approveHint: formatPairingApproveHint("dingtalk"),
        normalizeEntry: (raw) => {
          const trimmed = raw.trim();
          if (!trimmed.startsWith("user:")) {
            return `user:${trimmed}`;
          }
          return trimmed;
        },
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const defaultGroupPolicy = (cfg as ClawdbotConfig).channels?.defaults?.groupPolicy;
      const groupPolicy = account.groupPolicy ?? defaultGroupPolicy ?? "open";
      
      if (groupPolicy === "open") {
        warnings.push(
          `- 钉钉群聊: groupPolicy="open" 允许任何群成员触发（需要@机器人）。设置为 "allowlist" 并配置 groupAllowFrom 来限制群聊。`
        );
      }
      
      if (account.dmPolicy === "open") {
        warnings.push(
          `- 钉钉私聊: dmPolicy="open" 允许任何人私聊触发。建议设置为 "allowlist" 或 "pairing" 以提高安全性。`
        );
      }
      
      return warnings;
    },
  },
  messaging: {
    normalizeTarget: normalizeDingTalkMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return false;
        
        // 用户ID格式
        if (trimmed.startsWith("user:")) {
          const userId = trimmed.slice(5).trim();
          return userId.length > 0;
        }
        
        // 群聊ID格式
        if (trimmed.startsWith("chat:")) {
          const chatId = trimmed.slice(5).trim();
          return chatId.length > 0;
        }
        
        // 简单的ID格式
        return /^[a-zA-Z0-9_-]+$/.test(trimmed);
      },
      hint: "user:<userId> 或 chat:<chatId>",
    },
  },
  outbound: {
    send: async ({ cfg, to, message, options }) => {
      try {
        const config = cfg as ClawdbotConfig;
        const result = await sendDingTalkMessage(
          config,
          to,
          message,
          options as any
        );
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  agentPrompt: {
    messageToolHints: () => [
      "- 钉钉支持文本和Markdown消息格式",
      "- 使用 @ 功能：可以通过 atUserIds 或 atMobiles 参数@特定用户",
      "- 支持 @所有人：设置 isAtAll: true",
      "- 目标格式：user:<userId> 用于私聊，chat:<chatId> 用于群聊",
    ],
  },
};