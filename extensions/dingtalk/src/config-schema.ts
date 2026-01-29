import { z } from "zod";

export const DingTalkConfigSchema = z.object({
  enabled: z.boolean().default(true),
  webhookUrl: z.string().url().optional().describe({
    label: "Webhook URL",
    placeholder: "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    help: "钉钉机器人的Webhook地址",
  }),
  secret: z.string().optional().describe({
    label: "签名密钥",
    sensitive: true,
    help: "钉钉机器人的加签密钥",
  }),
  callbackPath: z.string().default("/dingtalk/callback").describe({
    label: "回调路径",
    placeholder: "/dingtalk/callback",
    help: "接收钉钉回调的HTTP路径",
  }),
  dmPolicy: z.enum(["open", "allowlist", "pairing"]).default("open").describe({
    label: "私聊策略",
    help: "控制谁可以通过私聊触发机器人",
  }),
  allowFrom: z.array(z.string()).default([]).describe({
    label: "允许来源",
    help: "允许触发机器人的用户ID列表",
  }),
  groupPolicy: z.enum(["open", "allowlist"]).default("open").describe({
    label: "群聊策略",
    help: "控制群聊中的触发策略",
  }),
  groupAllowFrom: z.array(z.string()).default([]).describe({
    label: "允许的群聊",
    help: "允许触发机器人的群聊ID列表",
  }),
});