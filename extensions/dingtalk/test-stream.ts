/**
 * 钉钉 Stream 模式测试脚本
 * 用于验证钉钉开发者后台配置是否正确
 *
 * 使用方法：
 * cd extensions/dingtalk && npx tsx test-stream.ts
 */

import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";

// 你的钉钉应用凭据
const CONFIG = {
  clientId: "ding2jfvdz0tzgfpjvmu",
  clientSecret: "TVUcAdmMu8PoGtxiy3SfH1bTFvp_AN689MgDHPU2U4F7lCyGjJYJJSzIJnWqJ2H6",
};

console.log("==========================================");
console.log("钉钉 Stream 模式连接测试");
console.log("==========================================");
console.log("");
console.log("应用配置：");
console.log(`  ClientId: ${CONFIG.clientId}`);
console.log(`  Topic: ${TOPIC_ROBOT}`);
console.log("");

const client = new DWClient({
  clientId: CONFIG.clientId,
  clientSecret: CONFIG.clientSecret,
  debug: true, // 开启调试模式
});

// 注册回调监听器
client.registerCallbackListener(TOPIC_ROBOT, async (res: unknown) => {
  const response = res as { headers?: { messageId?: string }; data?: unknown };
  console.log("");
  console.log("==========================================");
  console.log("🎉 收到钉钉消息！回调已触发！");
  console.log("==========================================");
  console.log("Headers:", JSON.stringify(response.headers, null, 2));
  console.log("Data:", response.data);
  console.log("");

  // 响应消息
  const messageId = response.headers?.messageId;
  if (messageId) {
    client.socketCallBackResponse(messageId, { success: true });
    console.log("✅ 已发送回调响应");
  }

  // 解析消息内容
  try {
    const data = JSON.parse(res.data);
    console.log("");
    console.log("解析后的消息：");
    console.log(`  发送者: ${data.senderNick} (${data.senderId})`);
    console.log(`  消息类型: ${data.msgtype}`);
    console.log(`  消息内容: ${data.text?.content || "[非文本消息]"}`);
    console.log(`  会话类型: ${data.conversationType === "1" ? "私聊" : "群聊"}`);
  } catch (err) {
    console.error("解析消息失败:", err);
  }
});

// 连接到钉钉
console.log("正在连接到钉钉 Stream 服务...");
console.log("");

client
  .connect()
  .then(() => {
    console.log("");
    console.log("==========================================");
    console.log("✅ 连接成功！");
    console.log("==========================================");
    console.log("");
    console.log("现在请在钉钉中给机器人发送一条消息...");
    console.log("");
    console.log("如果 30 秒内没有收到消息，请检查：");
    console.log("1. 钉钉开发者后台 → 应用能力 → 机器人 → 消息接收模式 → 是否选择了 'Stream 模式'");
    console.log("2. 应用是否已发布（不是'开发中'状态）");
    console.log("3. 机器人是否已上线");
    console.log("");
    console.log("按 Ctrl+C 退出");
  })
  .catch((err: unknown) => {
    const error = err as Error;
    console.error("");
    console.error("==========================================");
    console.error("❌ 连接失败！");
    console.error("==========================================");
    console.error("错误信息:", error.message || err);
    console.error("");
    console.error("请检查：");
    console.error("1. ClientId 和 ClientSecret 是否正确");
    console.error("2. 应用是否已创建并配置了机器人能力");
    process.exit(1);
  });

// 保持进程运行
process.on("SIGINT", () => {
  console.log("");
  console.log("正在断开连接...");
  process.exit(0);
});
