// Narrow plugin-sdk surface for the dingtalk extension.
// Keep this list additive and scoped to symbols used under extensions/dingtalk.

export { buildChannelConfigSchema } from "../channels/plugins/config-schema.js";
export { extractToolSend } from "./tool-send.js";
export { jsonResult, readStringParam } from "../agents/tools/common.js";
export type { OpenClawConfig } from "../config/config.js";
export type {
  ChannelSetupAdapter,
  ChannelGatewayContext,
} from "../channels/plugins/types.adapters.js";
export type {
  ChannelAccountSnapshot,
  ChannelLogSink,
  ChannelMessageActionAdapter,
} from "../channels/plugins/types.core.js";
export type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
export type { ChannelSetupWizardAdapter } from "../channels/plugins/setup-wizard-types.js";
export type { WizardPrompter } from "../wizard/prompts.js";
export type { PluginRuntime } from "../plugins/runtime/types.js";
export { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";
export { formatDocsLink } from "../terminal/links.js";
export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export type { OpenClawPluginApi } from "../plugins/types.js";
