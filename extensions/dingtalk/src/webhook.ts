import crypto from "crypto";
import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { DingTalkWebhookMessage } from "./types.js";

export function verifyDingTalkSignature(
  timestamp: string,
  sign: string,
  secret: string,
  body: string
): boolean {
  try {
    const stringToSign = `${timestamp}\n${secret}`;
    const expectedSign = crypto
      .createHmac("sha256", secret)
      .update(stringToSign)
      .digest("base64");
    const decodedSign = decodeURIComponent(sign);
    return decodedSign === expectedSign;
  } catch {
    return false;
  }
}

export function parseDingTalkWebhook(
  body: any,
  config: ClawdbotConfig
): DingTalkWebhookMessage | null {
  const dingtalkConfig = config.channels?.dingtalk;
  
  if (!body || typeof body !== "object") {
    return null;
  }

  // 钉钉回调格式示例（简化版）
  // 实际格式需要参考钉钉官方文档
  if (body.msgtype === "text" && body.text?.content) {
    return {
      msgtype: "text",
      text: {
        content: body.text.content,
      },
      senderId: body.senderId || body.senderStaffId || "unknown",
      senderNick: body.senderNick || body.senderNickname || "unknown",
      conversationId: body.conversationId || body.chatbotUserId || "unknown",
      conversationType: body.conversationType === "2" ? "group" : "private",
      createAt: body.createAt || body.msgCreateTime || Date.now(),
      msgId: body.msgId || body.msgid || `${Date.now()}`,
    };
  }

  return null;
}

export function adaptFromDingTalkMessage(
  dingtalkMsg: DingTalkWebhookMessage
): {
  text: string;
  sender: string;
  conversationId: string;
  isGroup: boolean;
  msgId: string;
} {
  return {
    text: dingtalkMsg.text?.content || "",
    sender: dingtalkMsg.senderId,
    conversationId: dingtalkMsg.conversationId,
    isGroup: dingtalkMsg.conversationType === "group",
    msgId: dingtalkMsg.msgId,
  };
}

export function createDingTalkWebhookHandler(config: ClawdbotConfig) {
  const dingtalkConfig = config.channels?.dingtalk;
  
  return async (req: any, res: any) => {
    try {
      // 验证签名
      const timestamp = req.headers["timestamp"] as string;
      const sign = req.headers["sign"] as string;
      const secret = dingtalkConfig?.secret;
      
      if (secret && timestamp && sign) {
        const bodyString = JSON.stringify(req.body);
        const isValid = verifyDingTalkSignature(timestamp, sign, secret, bodyString);
        if (!isValid) {
          res.status(403).json({ errcode: 403, errmsg: "签名验证失败" });
          return;
        }
      }

      // 解析消息
      const dingtalkMsg = parseDingTalkWebhook(req.body, config);
      if (!dingtalkMsg) {
        res.status(400).json({ errcode: 400, errmsg: "无效的消息格式" });
        return;
      }

      // 转换为Clawdbot格式
      const adaptedMsg = adaptFromDingTalkMessage(dingtalkMsg);
      
      // 这里应该将消息转发到Clawdbot的消息总线
      // 实际实现需要集成到Clawdbot的inbound消息系统
      
      // 返回成功响应
      res.json({ errcode: 0, errmsg: "ok" });
      
    } catch (error) {
      console.error("DingTalk webhook error:", error);
      res.status(500).json({ errcode: 500, errmsg: "服务器内部错误" });
    }
  };
}