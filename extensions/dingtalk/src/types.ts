/**
 * Type definitions for DingTalk Channel Plugin
 *
 * Provides comprehensive type safety for:
 * - Configuration objects
 * - DingTalk API request/response models
 * - Message content and formats
 * - Media files and streams
 * - Session and token management
 */

import type { MoltbotConfig } from "openclaw/plugin-sdk";

/**
 * DingTalk channel configuration
 */
export interface DingTalkConfig {
  clientId: string;
  clientSecret: string;
  robotCode?: string;
  corpId?: string;
  agentId?: string | number;
  name?: string;
  enabled?: boolean;
  dmPolicy?: "open" | "pairing" | "allowlist";
  groupPolicy?: "open" | "allowlist";
  allowFrom?: string[];
  showThinking?: boolean;
  /** Cache TTL for sessionWebhook-based outbound fallback (ms). 0 disables caching. */
  sessionWebhookCacheTtlMs?: number;
  /** If proactive send fails, fall back to sessionWebhook send (Stream mode). */
  outboundFallbackToSessionWebhook?: boolean;
  /** In group chats, best-effort @ the last triggering sender when using sessionWebhook fallback. */
  mentionSenderInGroupFallback?: boolean;
  debug?: boolean;
  messageType?: "text" | "markdown" | "card";
  cardTemplateId?: string;
  cardSendApiUrl?: string;
  cardUpdateApiUrl?: string;
  accounts?: Record<string, DingTalkConfig>;
}

/**
 * DingTalk token info for caching
 */
export interface TokenInfo {
  accessToken: string;
  expireIn: number;
}

/**
 * Media file metadata
 */
export interface MediaFile {
  path: string;
  mimeType: string;
}

/**
 * DingTalk incoming message (Stream mode)
 */
export interface DingTalkInboundMessage {
  msgId: string;
  msgtype: string;
  createAt: number;
  text?: {
    content: string;
  };
  content?: {
    downloadCode?: string;
    fileName?: string;
    recognition?: string;
    richText?: Array<{
      type: string;
      text?: string;
      atName?: string;
    }>;
  };
  conversationType: string;
  conversationId: string;
  conversationTitle?: string;
  senderId: string;
  senderStaffId?: string;
  senderNick?: string;
  chatbotUserId: string;
  sessionWebhook: string;
}

/**
 * Extracted message content for unified processing
 */
export interface MessageContent {
  text: string;
  mediaPath?: string;
  mediaType?: string;
  messageType: string;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  title?: string;
  useMarkdown?: boolean;
  atUserId?: string | null;
  log?: Logger;
}

/**
 * Session webhook response
 */
export interface SessionWebhookResponse {
  msgtype: string;
  markdown?: {
    title: string;
    text: string;
  };
  text?: {
    content: string;
  };
  at?: {
    atUserIds: string[];
    isAtAll: boolean;
  };
}

/**
 * Message handler parameters
 */
export interface HandleDingTalkMessageParams {
  cfg: MoltbotConfig;
  accountId: string;
  data: DingTalkInboundMessage;
  sessionWebhook: string;
  log?: Logger;
  dingtalkConfig: DingTalkConfig;
}

/**
 * Proactive message payload
 */
export interface ProactiveMessagePayload {
  robotCode: string;
  msgKey: string;
  msgParam: string;
  openConversationId?: string;
  userIds?: string[];
}

/**
 * Account descriptor
 */
export interface AccountDescriptor {
  accountId: string;
  config?: DingTalkConfig;
  enabled?: boolean;
  name?: string;
  configured?: boolean;
}

/**
 * Account resolver result
 */
export interface ResolvedAccount {
  accountId: string;
  config: DingTalkConfig;
  enabled: boolean;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  log?: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}

/**
 * Plugin gateway start context
 */
export interface GatewayStartContext {
  account: ResolvedAccount;
  cfg: MoltbotConfig;
  abortSignal?: AbortSignal;
  log?: Logger;
}

/**
 * Plugin gateway account stop result
 */
export interface GatewayStopResult {
  stop: () => void;
}

/**
 * Interactive card data structure
 */
export interface InteractiveCardData {
  config?: {
    autoLayout?: boolean;
    enableForward?: boolean;
  };
  header?: {
    title: {
      type: string;
      text: string;
    };
    logo?: string;
  };
  contents?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Interactive card send request payload
 */
export interface InteractiveCardSendRequest {
  cardTemplateId: string;
  cardBizId: string;
  robotCode: string;
  openConversationId?: string;
  singleChatReceiver?: string;
  cardData: string;
  callbackUrl?: string;
  userIdPrivateDataMap?: string;
  unionIdPrivateDataMap?: string;
}

/**
 * Interactive card update request payload
 */
export interface InteractiveCardUpdateRequest {
  cardBizId: string;
  cardData: string;
  userIdPrivateDataMap?: string;
  unionIdPrivateDataMap?: string;
  updateOptions?: {
    updateCardDataByKey?: boolean;
    updatePrivateDataByKey?: boolean;
  };
}

/**
 * Card instance tracking info for streaming updates
 */
export interface CardInstance {
  cardBizId: string;
  conversationId: string;
  createdAt: number;
  lastUpdated: number;
}

/**
 * HTTP response type
 */
export interface AxiosResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}
