import type { PluginRuntime } from "openclaw/plugin-sdk";

type MoltbotRuntime = PluginRuntime;

let dingtalkRuntime: MoltbotRuntime | undefined;

export function setDingTalkRuntime(runtime: MoltbotRuntime) {
  dingtalkRuntime = runtime;
}

export function getDingTalkRuntime(): MoltbotRuntime {
  if (!dingtalkRuntime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return dingtalkRuntime;
}