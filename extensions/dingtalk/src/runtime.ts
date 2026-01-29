import type { ClawdbotRuntime } from "clawdbot/plugin-sdk";

let dingtalkRuntime: ClawdbotRuntime | undefined;

export function setDingTalkRuntime(runtime: ClawdbotRuntime) {
  dingtalkRuntime = runtime;
}

export function getDingTalkRuntime(): ClawdbotRuntime {
  if (!dingtalkRuntime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return dingtalkRuntime;
}