export interface DingTalkMessage {
  msgtype: string;
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  link?: {
    title: string;
    text: string;
    messageUrl: string;
    picUrl?: string;
  };
  actionCard?: {
    title: string;
    text: string;
    singleTitle?: string;
    singleURL?: string;
    btnOrientation?: "0" | "1";
    btns?: Array<{
      title: string;
      actionURL: string;
    }>;
  };
  at?: {
    atMobiles?: string[];
    atUserIds?: string[];
    isAtAll?: boolean;
  };
}

export interface DingTalkWebhookMessage {
  msgtype: string;
  text?: {
    content: string;
  };
  senderId: string;
  senderNick: string;
  conversationId: string;
  conversationType: "private" | "group";
  createAt: number;
  msgId: string;
}

export interface DingTalkConfig {
  enabled?: boolean;
  webhookUrl?: string;
  secret?: string;
  callbackPath?: string;
  dmPolicy?: "open" | "allowlist" | "pairing";
  allowFrom?: string[];
  groupPolicy?: "open" | "allowlist";
  groupAllowFrom?: string[];
}

export interface ResolvedDingTalkAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  webhookUrl?: string;
  secret?: string;
  callbackPath?: string;
  dmPolicy?: "open" | "allowlist" | "pairing";
  allowFrom?: string[];
  groupPolicy?: "open" | "allowlist";
  groupAllowFrom?: string[];
}