// Narrow plugin-sdk surface for the dingtalk extension.
// Keep this list additive and scoped to symbols used under extensions/dingtalk.

export { buildChannelConfigSchema } from "../channels/plugins/config-schema.js";
export { extractToolSend } from "./tool-send.js";
export { jsonResult, readStringParam } from "../agents/tools/common.js";
export type { OpenClawConfig } from "../config/config.js";
export type { ChannelSetupAdapter } from "../channels/plugins/types.js";
export type { WizardPrompter } from "../wizard/prompts.js";
export type { PluginRuntime } from "../plugins/runtime/types.js";
export { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";
export { formatDocsLink } from "../terminal/links.js";
export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export type { OpenClawPluginApi } from "../plugins/types.js";
