import crypto from "crypto";
import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { DingTalkMessage } from "./types.js";

export async function sendDingTalkMessage(
  config: ClawdbotConfig,
  target: string,
  text: string,
  options?: {
    atUserIds?: string[];
    atMobiles?: string[];
    isAtAll?: boolean;
    messageType?: "text" | "markdown";
    markdownTitle?: string;
  }
): Promise<{ errcode: number; errmsg: string }> {
  const dingtalkConfig = config.channels?.dingtalk;
  if (!dingtalkConfig?.webhookUrl) {
    throw new Error("DingTalk webhook URL not configured");
  }

  const messageType = options?.messageType || "text";
  const message: DingTalkMessage = {
    msgtype: messageType,
  };

  if (messageType === "text") {
    message.text = {
      content: text,
    };
  } else if (messageType === "markdown") {
    message.markdown = {
      title: options?.markdownTitle || "消息",
      text: text,
    };
  }

  if (options?.atUserIds?.length || options?.atMobiles?.length || options?.isAtAll) {
    message.at = {
      atUserIds: options.atUserIds,
      atMobiles: options.atMobiles,
      isAtAll: options.isAtAll,
    };
  }

  const webhookUrl = dingtalkConfig.webhookUrl;
  const secret = dingtalkConfig.secret;
  
  let finalUrl = webhookUrl;
  if (secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto
      .createHmac("sha256", secret)
      .update(stringToSign)
      .digest("base64");
    const encodedSign = encodeURIComponent(sign);
    const separator = webhookUrl.includes("?") ? "&" : "?";
    finalUrl = `${webhookUrl}${separator}timestamp=${timestamp}&sign=${encodedSign}`;
  }

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DingTalk API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  if (result.errcode !== 0) {
    throw new Error(`DingTalk error: ${result.errmsg}`);
  }

  return result;
}

export function adaptToDingTalkMessage(
  clawdbotMessage: string,
  options?: {
    atUserIds?: string[];
    atMobiles?: string[];
    isAtAll?: boolean;
    messageType?: "text" | "markdown";
    markdownTitle?: string;
  }
): DingTalkMessage {
  const messageType = options?.messageType || "text";
  const message: DingTalkMessage = {
    msgtype: messageType,
  };

  if (messageType === "text") {
    message.text = {
      content: clawdbotMessage,
    };
  } else if (messageType === "markdown") {
    message.markdown = {
      title: options?.markdownTitle || "消息",
      text: clawdbotMessage,
    };
  }

  if (options?.atUserIds?.length || options?.atMobiles?.length || options?.isAtAll) {
    message.at = {
      atUserIds: options.atUserIds,
      atMobiles: options.atMobiles,
      isAtAll: options.isAtAll,
    };
  }

  return message;
}