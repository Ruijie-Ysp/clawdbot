import { defineChannelPluginEntry, buildChannelConfigSchema } from "openclaw/plugin-sdk/core";
import { weixinPlugin } from "./src/channel.js";
import { WeixinDemoPluginConfigSchema } from "./src/config/config-schema.js";
import { registerWeixinCli } from "./src/log-upload.js";
import { setWeixinRuntime } from "./src/runtime.js";
import { createWeixinDemoService } from "./src/service/index.js";

export { weixinPlugin } from "./src/channel.js";
export { setWeixinRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "weixin",
  name: "Weixin",
  description: "Weixin channel plugin with multi-account QR onboarding",
  plugin: weixinPlugin,
  configSchema: buildChannelConfigSchema(WeixinDemoPluginConfigSchema),
  setRuntime: setWeixinRuntime,
  registerFull(api) {
    api.registerCli(({ program, config }) => registerWeixinCli({ program, config }), {
      commands: ["weixin"],
    });
    api.registerService(createWeixinDemoService(api));
  },
});
