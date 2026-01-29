import type {
  ChannelOutboundAdapter,
  ClawdbotConfig,
} from "clawdbot/plugin-sdk";
import { sendDingTalkMessage } from "./send.js";

export const dingtalkOutbound: ChannelOutboundAdapter = {
  id: "dingtalk",
  send: async ({ cfg, to, message, options }) => {
    try {
      const config = cfg as ClawdbotConfig;
      
      // 解析选项
      const atUserIds = options?.atUserIds as string[] | undefined;
      const atMobiles = options?.atMobiles as string[] | undefined;
      const isAtAll = options?.isAtAll as boolean | undefined;
      const messageType = options?.messageType as "text" | "markdown" | undefined;
      const markdownTitle = options?.markdownTitle as string | undefined;
      
      const result = await sendDingTalkMessage(
        config,
        to,
        message,
        {
          atUserIds,
          atMobiles,
          isAtAll,
          messageType,
          markdownTitle,
        }
      );
      
      return {
        success: true,
        messageId: `${Date.now()}`,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  canSend: ({ cfg }) => {
    const config = cfg as ClawdbotConfig;
    const dingtalkConfig = config.channels?.dingtalk;
    return Boolean(dingtalkConfig?.enabled !== false && dingtalkConfig?.webhookUrl);
  },
  
  describe: ({ cfg }) => {
    const config = cfg as ClawdbotConfig;
    const dingtalkConfig = config.channels?.dingtalk;
    
    if (!dingtalkConfig) {
      return { configured: false, status: "未配置" };
    }
    
    if (dingtalkConfig.enabled === false) {
      return { configured: true, status: "已禁用" };
    }
    
    if (!dingtalkConfig.webhookUrl) {
      return { configured: false, status: "缺少Webhook URL" };
    }
    
    return {
      configured: true,
      status: "就绪",
      details: {
        webhookConfigured: Boolean(dingtalkConfig.webhookUrl),
        hasSecret: Boolean(dingtalkConfig.secret),
        dmPolicy: dingtalkConfig.dmPolicy || "open",
      },
    };
  },
};