import type { EventLogEntry } from "./app-events.ts";
import type { OpenClawApp } from "./app.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { GatewayEventFrame, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import type { UiSettings } from "./storage.ts";
import type {
  AgentsListResult,
  PresenceEntry,
  HealthSnapshot,
  StatusSummary,
  GatewaySessionRow,
} from "./types.ts";
import { CHAT_SESSIONS_ACTIVE_MINUTES, flushChatQueueForEvent } from "./app-chat.ts";
import {
  applySettings,
  loadCron,
  refreshActiveTab,
  setLastActiveSessionKey,
} from "./app-settings.ts";
import { handleAgentEvent, resetToolStream, type AgentEventPayload } from "./app-tool-stream.ts";
import { findChatPanelByRunId, findChatPanelsBySessionKey } from "./chat-panel-registry.ts";
import { loadAgents } from "./controllers/agents.ts";
import { loadAssistantIdentity } from "./controllers/assistant-identity.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import { handleChatEvent, type ChatEventPayload, type ChatState } from "./controllers/chat.ts";
import { loadDebug } from "./controllers/debug.ts";
import { loadDevices } from "./controllers/devices.ts";
import {
  addExecApproval,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  removeExecApproval,
} from "./controllers/exec-approval.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import { loadSessions, patchSession } from "./controllers/sessions.ts";
import { GatewayBrowserClient } from "./gateway.ts";
import { t, tp } from "./i18n/index.js";

const GAP_SELF_HEAL_DEBOUNCE_MS = 3000;

type GatewayHost = {
  settings: UiSettings;
  password: string;
  client: GatewayBrowserClient | null;
  connected: boolean;
  hello: GatewayHelloOk | null;
  lastError: string | null;
  onboarding?: boolean;
  eventLogBuffer: EventLogEntry[];
  eventLog: EventLogEntry[];
  tab: Tab;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: StatusSummary | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  debugHealth: HealthSnapshot | null;
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatRunId: string | null;
  refreshSessionsAfterChat: Set<string>;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalError: string | null;

  /** Internal state for event-gap recovery (best-effort resync). */
  gapRecovery?: { lastAttemptAt: number; inFlight: boolean };
};

function recordLocalEvent(host: GatewayHost, event: string, payload: unknown) {
  host.eventLogBuffer = [{ ts: Date.now(), event, payload }, ...host.eventLogBuffer].slice(0, 250);
  if (host.tab === "debug") {
    host.eventLog = host.eventLogBuffer;
  }
}

async function attemptGapSelfHeal(host: GatewayHost, info: { expected: number; received: number }) {
  // Gap can only happen on a live stream, but keep this resilient.
  if (!host.client || !host.connected) {
    return;
  }

  const now = Date.now();
  const state = (host.gapRecovery ??= {
    lastAttemptAt: Number.NEGATIVE_INFINITY,
    inFlight: false,
  });
  if (state.inFlight) {
    return;
  }
  if (now - state.lastAttemptAt < GAP_SELF_HEAL_DEBOUNCE_MS) {
    return;
  }

  const prevError = host.lastError;
  state.lastAttemptAt = now;
  state.inFlight = true;

  try {
    const tasks: Promise<unknown>[] = [
      loadDebug(host as unknown as OpenClawApp),
      loadPresence(host as unknown as OpenClawApp),
      refreshActiveTab(host as unknown as Parameters<typeof refreshActiveTab>[0]),
    ];

    // Avoid wiping in-flight chat errors/stream while a message is sending/running.
    if (!host.chatRunId) {
      tasks.push(loadChatHistory(host as unknown as Parameters<typeof loadChatHistory>[0]));
    }

    const results = await Promise.allSettled(tasks);

    // Option 1: if self-heal succeeds, do not show a red banner.
    // Only if we hard-failed (promise rejection) AND there isn't already a user-facing error,
    // fall back to the generic event-gap message.
    const hasHardFailure = results.some((r) => r.status === "rejected");
    if (hasHardFailure) {
      if (!host.lastError) {
        host.lastError = tp("app.errors.eventGap", {
          expected: String(info.expected),
          received: String(info.received),
        });
      }
      return;
    }

    // Preserve any pre-existing error (avoid hiding unrelated issues).
    if (prevError) {
      host.lastError = prevError;
    }
  } finally {
    state.inFlight = false;
  }
}

type SessionDefaultsSnapshot = {
  defaultAgentId?: string;
  mainKey?: string;
  mainSessionKey?: string;
  scope?: string;
};

/**
 * Automatically generate a session title based on the first user message.
 * This is called after a chat completes successfully.
 */
async function maybeGenerateSessionTitle(
  host: OpenClawApp,
  params: {
    sessionKey: string;
    messages: Array<{ role: string; content: unknown }>;
  },
): Promise<void> {
  // Only generate title if the session has no label
  const sessions = host.sessionsResult?.sessions ?? [];
  const currentSession = sessions.find((s: GatewaySessionRow) => s.key === params.sessionKey);

  // Skip if session already has a label or if we can't find the session
  if (!currentSession || currentSession.label?.trim()) {
    return;
  }

  // Get the first user message from chat history
  const firstUserMessage = params.messages.find((m) => m.role === "user");
  if (!firstUserMessage) {
    return;
  }

  // Extract text from the first user message
  let messageText = "";
  const content = firstUserMessage.content;
  if (typeof content === "string") {
    messageText = content;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === "object" && part !== null && "type" in part) {
        const p = part as { type: string; text?: string };
        if (p.type === "text" && p.text) {
          messageText = p.text;
          break;
        }
      }
    }
  }

  if (!messageText.trim()) {
    return;
  }

  // Generate a concise title from the message (simple truncation for now)
  // We take the first meaningful part of the message
  let title = messageText.trim();

  // Remove common prefixes like "请" "帮我" "我想"
  title = title.replace(/^(请|帮我|我想|我要|能不能|可以|麻烦|你好|Hi|Hello|Hey)\s*/gi, "");

  // Truncate to reasonable length (30 chars max)
  if (title.length > 30) {
    title = title.slice(0, 27) + "...";
  }

  // Don't generate empty or too short titles
  if (title.length < 2) {
    return;
  }

  // Update the session label
  try {
    await patchSession(host, params.sessionKey, { label: title });
  } catch (err) {
    // Silent failure - title generation is not critical
    console.warn("Failed to auto-generate session title:", err);
  }
}

function normalizeSessionKeyForDefaults(
  value: string | undefined,
  defaults: SessionDefaultsSnapshot,
): string {
  const raw = (value ?? "").trim();
  const mainSessionKey = defaults.mainSessionKey?.trim();
  if (!mainSessionKey) {
    return raw;
  }
  if (!raw) {
    return mainSessionKey;
  }
  const mainKey = defaults.mainKey?.trim() || "main";
  const defaultAgentId = defaults.defaultAgentId?.trim();
  const isAlias =
    raw === "main" ||
    raw === mainKey ||
    (defaultAgentId &&
      (raw === `agent:${defaultAgentId}:main` || raw === `agent:${defaultAgentId}:${mainKey}`));
  return isAlias ? mainSessionKey : raw;
}

function applySessionDefaults(host: GatewayHost, defaults?: SessionDefaultsSnapshot) {
  if (!defaults?.mainSessionKey) {
    return;
  }
  const resolvedSessionKey = normalizeSessionKeyForDefaults(host.sessionKey, defaults);
  const resolvedSettingsSessionKey = normalizeSessionKeyForDefaults(
    host.settings.sessionKey,
    defaults,
  );
  const resolvedLastActiveSessionKey = normalizeSessionKeyForDefaults(
    host.settings.lastActiveSessionKey,
    defaults,
  );
  const nextSessionKey = resolvedSessionKey || resolvedSettingsSessionKey || host.sessionKey;
  const nextSettings = {
    ...host.settings,
    sessionKey: resolvedSettingsSessionKey || nextSessionKey,
    lastActiveSessionKey: resolvedLastActiveSessionKey || nextSessionKey,
  };
  const shouldUpdateSettings =
    nextSettings.sessionKey !== host.settings.sessionKey ||
    nextSettings.lastActiveSessionKey !== host.settings.lastActiveSessionKey;
  if (nextSessionKey !== host.sessionKey) {
    host.sessionKey = nextSessionKey;
  }
  if (shouldUpdateSettings) {
    applySettings(host as unknown as Parameters<typeof applySettings>[0], nextSettings);
  }
}

export function connectGateway(host: GatewayHost) {
  host.lastError = null;
  host.hello = null;
  host.connected = false;
  host.execApprovalQueue = [];
  host.execApprovalError = null;

  const previousClient = host.client;
  const client = new GatewayBrowserClient({
    url: host.settings.gatewayUrl,
    token: host.settings.token.trim() ? host.settings.token : undefined,
    password: host.password.trim() ? host.password : undefined,
    clientName: "openclaw-control-ui",
    mode: "webchat",
    onHello: (hello) => {
      if (host.client !== client) {
        return;
      }
      host.connected = true;
      host.lastError = null;
      host.hello = hello;
      applySnapshot(host, hello);
      // Reset orphaned chat run state from before disconnect.
      // Any in-flight run's final event was lost during the disconnect window.
      host.chatRunId = null;
      (host as unknown as { chatStream: string | null }).chatStream = null;
      (host as unknown as { chatStreamStartedAt: number | null }).chatStreamStartedAt = null;
      resetToolStream(host as unknown as Parameters<typeof resetToolStream>[0]);
      void loadAssistantIdentity(host as unknown as OpenClawApp);
      void loadAgents(host as unknown as OpenClawApp);
      void loadNodes(host as unknown as OpenClawApp, { quiet: true });
      void loadDevices(host as unknown as OpenClawApp, { quiet: true });
      void refreshActiveTab(host as unknown as Parameters<typeof refreshActiveTab>[0]);
    },
    onClose: ({ code, reason }) => {
      if (host.client !== client) {
        return;
      }
      host.connected = false;
      // Code 1012 = Service Restart (expected during config saves, don't show as error)
      if (code !== 1012) {
        const reasonText = reason || t("app.errors.noReason");
        host.lastError = tp("app.errors.disconnected", {
          code: String(code),
          reason: reasonText,
        });
      }
    },
    onEvent: (evt) => {
      if (host.client !== client) {
        return;
      }
      handleGatewayEvent(host, evt);
    },
    onGap: ({ expected, received }) => {
      recordLocalEvent(host, "gateway.gap", { expected, received });
      void attemptGapSelfHeal(host, { expected, received });
    },
  });
  host.client = client;
  previousClient?.stop();
  client.start();
}

export function handleGatewayEvent(host: GatewayHost, evt: GatewayEventFrame) {
  try {
    handleGatewayEventUnsafe(host, evt);
  } catch (err) {
    console.error("[gateway] handleGatewayEvent error:", evt.event, err);
  }
}

function handleGatewayEventUnsafe(host: GatewayHost, evt: GatewayEventFrame) {
  host.eventLogBuffer = [
    { ts: Date.now(), event: evt.event, payload: evt.payload },
    ...host.eventLogBuffer,
  ].slice(0, 250);
  if (host.tab === "debug") {
    host.eventLog = host.eventLogBuffer;
  }

  if (evt.event === "agent") {
    if (host.onboarding) {
      return;
    }
    const payload = evt.payload as AgentEventPayload | undefined;
    const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : "";
    if (sessionKey) {
      const panels = findChatPanelsBySessionKey(sessionKey);
      if (panels.length) {
        for (const panel of panels) {
          handleAgentEvent(panel as unknown as Parameters<typeof handleAgentEvent>[0], payload);
        }
        return;
      }
    }
    if (payload?.runId) {
      const panel = findChatPanelByRunId(payload.runId);
      if (panel) {
        handleAgentEvent(panel as unknown as Parameters<typeof handleAgentEvent>[0], payload);
        return;
      }
    }
    handleAgentEvent(host as unknown as Parameters<typeof handleAgentEvent>[0], payload);
    return;
  }

  if (evt.event === "chat") {
    const payload = evt.payload as ChatEventPayload | undefined;
    if (payload?.sessionKey) {
      setLastActiveSessionKey(
        host as unknown as Parameters<typeof setLastActiveSessionKey>[0],
        payload.sessionKey,
      );
    }
    const sessionKey = payload?.sessionKey ?? "";
    if (sessionKey) {
      const panels = findChatPanelsBySessionKey(sessionKey);
      if (panels.length) {
        for (const panel of panels) {
          const panelState = panel as unknown as ChatState;
          const state = handleChatEvent(panelState, payload);
          if (state === "final" || state === "error" || state === "aborted") {
            resetToolStream(panel as unknown as Parameters<typeof resetToolStream>[0]);
            void flushChatQueueForEvent(
              panel as unknown as Parameters<typeof flushChatQueueForEvent>[0],
            );
          }
          if (state === "final") {
            void loadChatHistory(panelState);
            void loadSessions(host as unknown as OpenClawApp);
            void maybeGenerateSessionTitle(host as unknown as OpenClawApp, {
              sessionKey: panelState.sessionKey,
              messages: panelState.chatMessages as Array<{ role: string; content: unknown }>,
            });
          }
        }
        return;
      }
    }
    const state = handleChatEvent(host as unknown as OpenClawApp, payload);
    if (state === "final" || state === "error" || state === "aborted") {
      resetToolStream(host as unknown as Parameters<typeof resetToolStream>[0]);
      void flushChatQueueForEvent(host as unknown as Parameters<typeof flushChatQueueForEvent>[0]);
      const runId = payload?.runId;
      if (runId && host.refreshSessionsAfterChat.has(runId)) {
        host.refreshSessionsAfterChat.delete(runId);
        if (state === "final") {
          void loadSessions(host as unknown as OpenClawApp, {
            activeMinutes: CHAT_SESSIONS_ACTIVE_MINUTES,
          });
        }
      }
    }
    if (state === "final") {
      void loadChatHistory(host as unknown as OpenClawApp);
      void loadSessions(host as unknown as OpenClawApp);
      const hostChat = host as unknown as ChatState;
      void maybeGenerateSessionTitle(host as unknown as OpenClawApp, {
        sessionKey: host.sessionKey,
        messages: hostChat.chatMessages as Array<{ role: string; content: unknown }>,
      });
    }
    return;
  }

  if (evt.event === "presence") {
    const payload = evt.payload as { presence?: PresenceEntry[] } | undefined;
    if (payload?.presence && Array.isArray(payload.presence)) {
      host.presenceEntries = payload.presence;
      host.presenceError = null;
      host.presenceStatus = null;
    }
    return;
  }

  if (evt.event === "cron" && host.tab === "cron") {
    void loadCron(host as unknown as Parameters<typeof loadCron>[0]);
  }

  if (evt.event === "device.pair.requested" || evt.event === "device.pair.resolved") {
    void loadDevices(host as unknown as OpenClawApp, { quiet: true });
  }

  if (evt.event === "exec.approval.requested") {
    const entry = parseExecApprovalRequested(evt.payload);
    if (entry) {
      host.execApprovalQueue = addExecApproval(host.execApprovalQueue, entry);
      host.execApprovalError = null;
      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, entry.id);
      }, delay);
    }
    return;
  }

  if (evt.event === "exec.approval.resolved") {
    const resolved = parseExecApprovalResolved(evt.payload);
    if (resolved) {
      host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, resolved.id);
    }
  }
}

export function applySnapshot(host: GatewayHost, hello: GatewayHelloOk) {
  const snapshot = hello.snapshot as
    | {
        presence?: PresenceEntry[];
        health?: HealthSnapshot;
        sessionDefaults?: SessionDefaultsSnapshot;
      }
    | undefined;
  if (snapshot?.presence && Array.isArray(snapshot.presence)) {
    host.presenceEntries = snapshot.presence;
  }
  if (snapshot?.health) {
    host.debugHealth = snapshot.health;
  }
  if (snapshot?.sessionDefaults) {
    applySessionDefaults(host, snapshot.sessionDefaults);
  }
}
