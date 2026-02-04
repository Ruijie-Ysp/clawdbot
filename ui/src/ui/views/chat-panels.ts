/**
 * Multi-panel chat view for rendering 1, 2, or 4 independent chat panels
 */

import { html } from "lit";
import type { ChatLayoutMode, ChatPanelState } from "../storage";
import type { AgentsListResult, GatewayAgentRow, SessionsListResult } from "../types";

export type ChatPanelsProps = {
  layoutMode: ChatLayoutMode;
  panels: ChatPanelState[];
  agents: AgentsListResult | null;
  sessions: SessionsListResult | null;
  defaultAgentId: string;
  // Events
  onPanelAgentChange: (panelIndex: number, agentId: string) => void;
  onPanelSessionChange: (panelIndex: number, sessionKey: string) => void;
  // Render function for individual chat panel content
  renderPanelContent: (panelIndex: number, agentId: string, sessionKey: string) => unknown;
};

function getAgentsList(agents: AgentsListResult | null): GatewayAgentRow[] {
  return agents?.agents ?? [];
}

function getPanelAgentId(
  panels: ChatPanelState[],
  panelIndex: number,
  defaultAgentId: string
): string {
  return panels[panelIndex]?.agentId ?? defaultAgentId;
}

function getPanelSessionKey(
  panels: ChatPanelState[],
  panelIndex: number,
  agentId: string
): string {
  const panel = panels[panelIndex];
  if (panel?.sessionKey) {
    return panel.sessionKey;
  }
  // Generate default session key based on agent
  return `agent:${agentId}:main`;
}

function resolveSessionOptions(sessionKey: string, sessions: SessionsListResult | null) {
  const seen = new Set<string>();
  const options: Array<{ key: string; displayName?: string }> = [];

  const resolvedCurrent = sessions?.sessions?.find((s) => s.key === sessionKey);
  const normalizedSessionKey = sessionKey.trim();

  if (normalizedSessionKey) {
    seen.add(normalizedSessionKey);
    options.push({ key: normalizedSessionKey, displayName: resolvedCurrent?.displayName });
  }

  if (sessions?.sessions) {
    for (const s of sessions.sessions) {
      if (!seen.has(s.key)) {
        seen.add(s.key);
        options.push({ key: s.key, displayName: s.displayName });
      }
    }
  }

  return options;
}

export function renderChatPanelsHeader() {
  return html`
    <div class="chat-panels-header">
      <span class="chat-panels-header__title">多窗口聊天</span>
    </div>
  `;
}

export function renderChatPanels(props: ChatPanelsProps) {
  const agentsList = getAgentsList(props.agents);
  const panelCount = props.layoutMode;

  // Build panel data for rendering
  const panelData = Array.from({ length: panelCount }, (_, i) => {
    const agentId = getPanelAgentId(props.panels, i, props.defaultAgentId);
    const sessionKey = getPanelSessionKey(props.panels, i, agentId);
    return { index: i, agentId, sessionKey };
  });

  return html`
    <div class="chat-panels-wrapper">
      ${renderChatPanelsHeader()}
      <div class="chat-panels-container chat-panels-container--${panelCount}">
        ${panelData.map(
          (panel) => html`
            <div class="chat-panel" data-panel-index=${panel.index}>
              <div class="chat-panel__header">
                <span class="chat-panel__index">${panel.index + 1}</span>
                <select
                  class="chat-panel__agent-select"
                  @change=${(e: Event) => {
                    const select = e.target as HTMLSelectElement;
                    props.onPanelAgentChange(panel.index, select.value);
                  }}
                  aria-label="选择 Agent"
                >
                  ${agentsList.map(
                    (agent) => html`
                      <option
                        value=${agent.id}
                        ?selected=${agent.id === panel.agentId}
                      >
                        ${agent.identity?.emoji ?? ""}
                        ${agent.identity?.name ?? agent.name ?? agent.id}
                      </option>
                    `
                  )}
                </select>
                <select
                  class="chat-panel__session-select"
                  .value=${panel.sessionKey}
                  @change=${(e: Event) => {
                    const select = e.target as HTMLSelectElement;
                    props.onPanelSessionChange(panel.index, select.value);
                  }}
                  aria-label="选择会话"
                >
                  ${resolveSessionOptions(panel.sessionKey, props.sessions).map(
                    (entry) => html`
                      <option value=${entry.key}>
                        ${entry.displayName ?? entry.key}
                      </option>
                    `,
                  )}
                </select>
              </div>
              <div class="chat-panel__content">
                ${props.renderPanelContent(
                  panel.index,
                  panel.agentId,
                  panel.sessionKey
                )}
              </div>
            </div>
          `
        )}
      </div>
    </div>
  `;
}
