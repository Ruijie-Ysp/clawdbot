# 钉钉通道插件 for Clawdbot

钉钉机器人集成插件，支持钉钉企业通讯平台。

## 功能特性

- ✅ 支持文本消息发送
- ✅ 支持Markdown消息格式
- ✅ 支持@特定用户或@所有人
- ✅ 支持私聊和群聊
- ✅ Webhook回调接收（基础）
- ✅ 安全加签验证
- ✅ 配置引导界面

## 安装

### 从源码安装
```bash
# 在clawdbot项目目录中
cd extensions/dingtalk
pnpm install
```

### 启用插件
在Clawdbot配置文件中启用插件：

```json
{
  "plugins": {
    "entries": {
      "dingtalk": {
        "enabled": true
      }
    }
  }
}
```

## 配置

### 钉钉机器人设置
1. 在钉钉开放平台创建机器人
2. 获取Webhook地址和签名密钥
3. 配置IP白名单（如果需要）

### Clawdbot配置示例
```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN",
      "secret": "YOUR_SECRET",
      "callbackPath": "/dingtalk/callback",
      "dmPolicy": "allowlist",
      "allowFrom": ["user123", "user456"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["chat123", "chat456"]
    }
  },
  "web": {
    "enabled": true,
    "port": 3000,
    "host": "0.0.0.0"
  }
}
```

## 使用方法

### 发送消息
```bash
# 通过CLI发送消息
clawdbot message --channel dingtalk --target "user:user123" --message "Hello from Clawdbot"

# 发送Markdown消息
clawdbot message --channel dingtalk --target "chat:chat123" --message "# 标题\n内容" --option '{"messageType":"markdown","markdownTitle":"通知"}'

# @特定用户
clawdbot message --channel dingtalk --target "chat:chat123" --message "请查看" --option '{"atUserIds":["user123"]}'
```

### 接收消息
1. 配置钉钉机器人的回调URL为：`http://your-server:3000/dingtalk/callback`
2. 钉钉用户发送消息后，Clawdbot会自动接收并处理
3. 可以在Clawdbot会话中回复消息

## 消息格式

### 文本消息
```json
{
  "msgtype": "text",
  "text": {
    "content": "消息内容"
  },
  "at": {
    "atUserIds": ["user123"],
    "isAtAll": false
  }
}
```

### Markdown消息
```json
{
  "msgtype": "markdown",
  "markdown": {
    "title": "标题",
    "text": "# 一级标题\n- 列表项1\n- 列表项2"
  }
}
```

## 安全设置

### 加签验证
如果钉钉机器人启用了加签，需要在配置中设置`secret`字段。

### 访问控制
- `dmPolicy`: 私聊策略（open/allowlist/pairing）
- `allowFrom`: 允许私聊的用户列表
- `groupPolicy`: 群聊策略（open/allowlist）
- `groupAllowFrom`: 允许的群聊列表

## 开发

### 项目结构
```
extensions/dingtalk/
├── package.json
├── index.ts                    # 插件入口
├── clawdbot.plugin.json       # 插件清单
└── src/
    ├── channel.ts             # 通道插件定义
    ├── runtime.ts             # 运行时逻辑
    ├── onboarding.ts          # 配置引导
    ├── outbound.ts            # 消息发送
    ├── webhook.ts             # 消息接收
    ├── types.ts               # 类型定义
    ├── config-schema.ts       # 配置schema
    └── send.ts                # 发送消息实现
```

### 构建
```bash
cd extensions/dingtalk
pnpm build
```

## 故障排除

### 常见问题
1. **消息发送失败**
   - 检查Webhook URL是否正确
   - 验证签名密钥（如果启用了加签）
   - 检查网络连接

2. **回调接收不到消息**
   - 确认回调URL可公开访问
   - 检查钉钉机器人回调配置
   - 查看Clawdbot日志

3. **权限问题**
   - 确认用户/群聊在允许列表中
   - 检查安全策略设置

### 日志查看
```bash
clawdbot logs --channel dingtalk
```

## 许可证
MIT