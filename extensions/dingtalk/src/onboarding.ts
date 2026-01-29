import type {
  OnboardingAdapter,
  OnboardingStep,
  OnboardingStepResult,
} from "clawdbot/plugin-sdk";

export const dingtalkOnboardingAdapter: OnboardingAdapter = {
  id: "dingtalk",
  label: "钉钉",
  description: "配置钉钉机器人集成",
  steps: [
    {
      id: "intro",
      label: "介绍",
      description: "钉钉机器人集成需要以下步骤：\n1. 在钉钉开放平台创建机器人\n2. 获取Webhook地址和签名密钥\n3. 配置Clawdbot接收回调",
      fields: [],
      validate: () => ({ valid: true }),
    },
    {
      id: "webhook",
      label: "Webhook配置",
      description: "请输入钉钉机器人的Webhook地址",
      fields: [
        {
          id: "webhookUrl",
          label: "Webhook URL",
          type: "string",
          required: true,
          placeholder: "https://oapi.dingtalk.com/robot/send?access_token=xxx",
          help: "在钉钉机器人设置中获取的Webhook地址",
        },
        {
          id: "secret",
          label: "签名密钥",
          type: "string",
          required: false,
          placeholder: "SECxxx",
          help: "钉钉机器人的加签密钥（如果启用了加签）",
          sensitive: true,
        },
      ],
      validate: (values) => {
        const webhookUrl = values.webhookUrl as string;
        if (!webhookUrl) {
          return { valid: false, error: "Webhook URL不能为空" };
        }
        try {
          new URL(webhookUrl);
          return { valid: true };
        } catch {
          return { valid: false, error: "请输入有效的URL" };
        }
      },
    },
    {
      id: "security",
      label: "安全设置",
      description: "配置谁可以触发机器人",
      fields: [
        {
          id: "dmPolicy",
          label: "私聊策略",
          type: "select",
          required: false,
          options: [
            { value: "open", label: "所有人" },
            { value: "allowlist", label: "仅允许列表" },
            { value: "pairing", label: "需要配对" },
          ],
          default: "open",
          help: "控制谁可以通过私聊触发机器人",
        },
        {
          id: "allowFrom",
          label: "允许的用户",
          type: "string",
          required: false,
          placeholder: "user1,user2,user3",
          help: "允许触发机器人的用户ID，用逗号分隔（仅当选择'仅允许列表'时生效）",
        },
      ],
      validate: () => ({ valid: true }),
    },
    {
      id: "callback",
      label: "回调配置",
      description: "配置钉钉回调到Clawdbot",
      fields: [
        {
          id: "callbackPath",
          label: "回调路径",
          type: "string",
          required: false,
          default: "/dingtalk/callback",
          placeholder: "/dingtalk/callback",
          help: "Clawdbot接收钉钉回调的HTTP路径",
        },
      ],
      validate: (values) => {
        const callbackPath = values.callbackPath as string;
        if (callbackPath && !callbackPath.startsWith("/")) {
          return { valid: false, error: "回调路径必须以/开头" };
        }
        return { valid: true };
      },
    },
  ],
  applyStep: (stepId, values, currentConfig) => {
    const config = { ...currentConfig };
    
    if (!config.channels) {
      config.channels = {};
    }
    
    if (!config.channels.dingtalk) {
      config.channels.dingtalk = {};
    }
    
    const dingtalkConfig = config.channels.dingtalk;
    
    switch (stepId) {
      case "webhook":
        dingtalkConfig.webhookUrl = values.webhookUrl as string;
        if (values.secret) {
          dingtalkConfig.secret = values.secret as string;
        }
        break;
        
      case "security":
        dingtalkConfig.dmPolicy = values.dmPolicy as string;
        if (values.allowFrom) {
          const allowFrom = (values.allowFrom as string)
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (allowFrom.length > 0) {
            dingtalkConfig.allowFrom = allowFrom;
          }
        }
        break;
        
      case "callback":
        if (values.callbackPath) {
          dingtalkConfig.callbackPath = values.callbackPath as string;
        }
        break;
    }
    
    dingtalkConfig.enabled = true;
    
    return config;
  },
};