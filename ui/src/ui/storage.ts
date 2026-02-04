const KEY = "openclaw.control.settings.v1";

import type { ThemeMode } from "./theme.ts";

export type ChatLayoutMode = 1 | 2 | 4; // 1, 2, or 4 panels

export type ChatPanelState = {
  agentId: string;
  sessionKey: string;
};

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
  sessionsSidebarOpen: boolean; // Sessions sidebar visibility in chat
  chatLayoutMode: ChatLayoutMode; // Multi-panel layout: 1, 2, or 4 panels
  chatPanels: ChatPanelState[]; // State for each panel (agent + session)
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    // In dev mode (port 5173), connect to gateway on port 18789 (normal mode)
    // Use localhost instead of 127.0.0.1 to preserve secure context for device auth
    const host = location.port === "5173" ? "localhost:18789" : location.host;
    return `${proto}://${host}`;
  })();

  const defaultPanels: ChatPanelState[] = [
    { agentId: "main", sessionKey: "main" },
    { agentId: "main", sessionKey: "main" },
    { agentId: "main", sessionKey: "main" },
    { agentId: "main", sessionKey: "main" },
  ];

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
    sessionsSidebarOpen: true,
    chatLayoutMode: 1,
    chatPanels: defaultPanels,
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" && parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean" ? parsed.chatFocusMode : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean" ? parsed.navCollapsed : defaults.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
      sessionsSidebarOpen:
        typeof parsed.sessionsSidebarOpen === "boolean"
          ? parsed.sessionsSidebarOpen
          : defaults.sessionsSidebarOpen,
      chatLayoutMode:
        typeof parsed.chatLayoutMode === "number" &&
        (parsed.chatLayoutMode === 1 || parsed.chatLayoutMode === 2 || parsed.chatLayoutMode === 4)
          ? parsed.chatLayoutMode
          : defaults.chatLayoutMode,
      chatPanels:
        Array.isArray(parsed.chatPanels) &&
        parsed.chatPanels.length === 4 &&
        parsed.chatPanels.every(
          (p): p is ChatPanelState =>
            typeof p === "object" &&
            p !== null &&
            typeof p.agentId === "string" &&
            typeof p.sessionKey === "string"
        )
          ? parsed.chatPanels
          : defaults.chatPanels,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
