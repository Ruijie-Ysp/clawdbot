export type ChatPanelHost = {
  panelIndex: number;
  sessionKey: string;
  chatRunId: string | null;
};

const registry = new Map<number, ChatPanelHost>();

export function registerChatPanel(host: ChatPanelHost) {
  registry.set(host.panelIndex, host);
  return () => {
    if (registry.get(host.panelIndex) === host) {
      registry.delete(host.panelIndex);
    }
  };
}

export function listChatPanels() {
  return Array.from(registry.values());
}

export function findChatPanelsBySessionKey(sessionKey: string) {
  return listChatPanels().filter((panel) => panel.sessionKey === sessionKey);
}

export function findChatPanelByRunId(runId: string) {
  return listChatPanels().find((panel) => panel.chatRunId === runId) ?? null;
}
