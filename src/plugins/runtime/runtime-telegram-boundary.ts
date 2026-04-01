import { createJiti } from "jiti";
import {
  loadPluginBoundaryModuleWithJiti,
  resolvePluginRuntimeModulePath,
  resolvePluginRuntimeRecord,
} from "./runtime-plugin-boundary.js";
import type { PluginRuntimeChannel } from "./types-channel.js";

const TELEGRAM_PLUGIN_ID = "telegram";

type TelegramRuntimeChannel = PluginRuntimeChannel["telegram"];

type TelegramPluginRecord = {
  rootDir?: string;
  source: string;
};

type TelegramRuntimeBoundaryModule = {
  collectTelegramUnmentionedGroupIds: TelegramRuntimeChannel["collectUnmentionedGroupIds"];
  resolveTelegramToken: TelegramRuntimeChannel["resolveTelegramToken"];
  telegramMessageActions: TelegramRuntimeChannel["messageActions"];
  setTelegramThreadBindingIdleTimeoutBySessionKey: TelegramRuntimeChannel["threadBindings"]["setIdleTimeoutBySessionKey"];
  setTelegramThreadBindingMaxAgeBySessionKey: TelegramRuntimeChannel["threadBindings"]["setMaxAgeBySessionKey"];
};

let cachedModulePath: string | null = null;
let cachedModule: TelegramRuntimeBoundaryModule | null = null;

const jitiLoaders = new Map<boolean, ReturnType<typeof createJiti>>();

function resolveTelegramPluginRecord(): TelegramPluginRecord | null {
  return resolvePluginRuntimeRecord(TELEGRAM_PLUGIN_ID) as TelegramPluginRecord | null;
}

function resolveTelegramRuntimeModulePath(record: TelegramPluginRecord): string | null {
  return resolvePluginRuntimeModulePath(record, "runtime-api");
}

function loadTelegramModule(): TelegramRuntimeBoundaryModule | null {
  const record = resolveTelegramPluginRecord();
  if (!record) {
    return null;
  }
  const modulePath = resolveTelegramRuntimeModulePath(record);
  if (!modulePath) {
    return null;
  }
  if (cachedModule && cachedModulePath === modulePath) {
    return cachedModule;
  }
  const loaded = loadPluginBoundaryModuleWithJiti<TelegramRuntimeBoundaryModule>(
    modulePath,
    jitiLoaders,
  );
  cachedModulePath = modulePath;
  cachedModule = loaded;
  return loaded;
}

function requireTelegramModule(
  reason: string,
): Exclude<ReturnType<typeof loadTelegramModule>, null> {
  const loaded = loadTelegramModule();
  if (!loaded) {
    throw new Error(`Telegram runtime module unavailable (${reason}).`);
  }
  return loaded;
}

function resolveTelegramMessageActions(): TelegramRuntimeChannel["messageActions"] | null {
  return loadTelegramModule()?.telegramMessageActions ?? null;
}

export function collectTelegramUnmentionedGroupIds(
  ...args: Parameters<TelegramRuntimeChannel["collectUnmentionedGroupIds"]>
): ReturnType<TelegramRuntimeChannel["collectUnmentionedGroupIds"]> {
  const fn = loadTelegramModule()?.collectTelegramUnmentionedGroupIds;
  if (typeof fn !== "function") {
    return {
      groupIds: [],
      unresolvedGroups: 0,
      hasWildcardUnmentionedGroups: false,
    };
  }
  return fn(...args);
}

export function resolveTelegramToken(
  ...args: Parameters<TelegramRuntimeChannel["resolveTelegramToken"]>
): ReturnType<TelegramRuntimeChannel["resolveTelegramToken"]> {
  return requireTelegramModule("resolve token").resolveTelegramToken(...args);
}

export function setTelegramThreadBindingIdleTimeoutBySessionKey(
  ...args: Parameters<TelegramRuntimeChannel["threadBindings"]["setIdleTimeoutBySessionKey"]>
): ReturnType<TelegramRuntimeChannel["threadBindings"]["setIdleTimeoutBySessionKey"]> {
  const fn = loadTelegramModule()?.setTelegramThreadBindingIdleTimeoutBySessionKey;
  if (typeof fn !== "function") {
    return [];
  }
  return fn(...args);
}

export function setTelegramThreadBindingMaxAgeBySessionKey(
  ...args: Parameters<TelegramRuntimeChannel["threadBindings"]["setMaxAgeBySessionKey"]>
): ReturnType<TelegramRuntimeChannel["threadBindings"]["setMaxAgeBySessionKey"]> {
  const fn = loadTelegramModule()?.setTelegramThreadBindingMaxAgeBySessionKey;
  if (typeof fn !== "function") {
    return [];
  }
  return fn(...args);
}

export const telegramMessageActions: TelegramRuntimeChannel["messageActions"] = {
  describeMessageTool: (params) =>
    resolveTelegramMessageActions()?.describeMessageTool(params) ?? null,
  supportsAction: (params) => resolveTelegramMessageActions()?.supportsAction?.(params) ?? false,
  requiresTrustedRequesterSender: (params) =>
    resolveTelegramMessageActions()?.requiresTrustedRequesterSender?.(params) ?? false,
  extractToolSend: (params) => resolveTelegramMessageActions()?.extractToolSend?.(params) ?? null,
  handleAction: async (ctx) => {
    const handleAction = resolveTelegramMessageActions()?.handleAction;
    if (!handleAction) {
      throw new Error("Telegram message action adapter unavailable.");
    }
    return await handleAction(ctx);
  },
};
