import type { PluginRuntime } from "openclaw/plugin-sdk";

// oxlint-disable-next-line typescript-eslint/no-redundant-type-constituents
let dingtalkRuntime: PluginRuntime | undefined;

export function setDingTalkRuntime(runtime: PluginRuntime) {
  dingtalkRuntime = runtime;
}

export function getDingTalkRuntime(): PluginRuntime {
  if (!dingtalkRuntime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return dingtalkRuntime;
}
