/**
 * Chat panel header with agent selector
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { GatewayAgentRow } from "../types";

@customElement("chat-panel-header")
export class ChatPanelHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-tertiary, #1a1a1a);
      border-bottom: 1px solid var(--border-color, #333);
    }

    .agent-select {
      flex: 1;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color, #333);
      background: var(--bg-secondary, #252525);
      color: var(--text-color, #fff);
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .agent-select:hover {
      border-color: var(--accent-color, #e85a2e);
    }

    .agent-select:focus {
      outline: none;
      border-color: var(--accent-color, #e85a2e);
      box-shadow: 0 0 0 2px rgba(232, 90, 46, 0.2);
    }

    .panel-index {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--accent-color, #e85a2e);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
    }
  `;

  @property({ type: Number })
  panelIndex = 0;

  @property({ type: String })
  selectedAgentId = "main";

  @property({ type: Array })
  agents: GatewayAgentRow[] = [];

  private _handleAgentChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const newAgentId = select.value;
    if (newAgentId !== this.selectedAgentId) {
      this.dispatchEvent(
        new CustomEvent("agent-change", {
          detail: { agentId: newAgentId, panelIndex: this.panelIndex },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    return html`
      <div class="panel-header">
        <span class="panel-index">${this.panelIndex + 1}</span>
        <select
          class="agent-select"
          @change=${this._handleAgentChange}
          aria-label="选择 Agent"
        >
          ${this.agents.map(
            (agent) => html`
              <option
                value=${agent.id}
                ?selected=${agent.id === this.selectedAgentId}
              >
                ${agent.identity?.emoji ?? ""} ${agent.identity?.name ?? agent.name ?? agent.id}
              </option>
            `
          )}
        </select>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-panel-header": ChatPanelHeader;
  }
}

