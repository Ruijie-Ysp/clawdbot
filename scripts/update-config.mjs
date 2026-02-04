import fs from "fs";
import os from "os";
import path from "path";

const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// 更新 agents.list，移除无效字段，添加 subagents.allowAgents
config.agents.list = [
  {
    id: "main",
    default: true,
    name: "通用助手",
    workspace: "~/clawd",
    identity: { name: "Clawd", emoji: "🦞" },
    subagents: { allowAgents: ["monitor", "medical", "coding"] },
  },
  {
    id: "monitor",
    name: "监控助手",
    model: { primary: "deepseek/deepseek-chat" },
    workspace: "~/clawd-monitor",
    identity: { name: "MonitorBot", emoji: "📊" },
    subagents: { allowAgents: ["main"] },
  },
  {
    id: "medical",
    name: "医疗助手",
    model: { primary: "moonshot/kimi-k2.5" },
    workspace: "~/clawd-medical",
    identity: { name: "MediBot", emoji: "🏥" },
    subagents: { allowAgents: ["main"] },
  },
  {
    id: "coding",
    name: "编程助手",
    model: { primary: "moonshot/kimi-k2.5" },
    workspace: "~/clawd-coding",
    identity: { name: "CodeBot", emoji: "💻" },
    subagents: { allowAgents: ["main"] },
  },
];

// 添加 tools.agentToAgent 启用 agent 间调用
config.tools = config.tools || {};
config.tools.agentToAgent = { enabled: true };

// 更新时间戳
config.meta = config.meta || {};
config.meta.lastTouchedAt = new Date().toISOString();

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("✅ 配置已更新成功！");
console.log("配置文件:", configPath);
