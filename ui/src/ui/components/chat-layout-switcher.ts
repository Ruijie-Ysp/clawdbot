/**
 * Chat layout switcher component for multi-panel chat layout
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatLayoutMode } from "../storage.ts";
import { onLocaleChanged, t } from "../i18n/index.ts";

@customElement("chat-layout-switcher")
export class ChatLayoutSwitcher extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .layout-switcher {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: var(--bg-secondary, #252525);
      border-radius: 6px;
    }

    .layout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-secondary-color, #888);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .layout-btn:hover {
      background: var(--bg-hover, #333);
      color: var(--text-color, #fff);
    }

    .layout-btn.active {
      background: var(--accent-color, #e85a2e);
      color: #fff;
    }

    .layout-icon {
      display: grid;
      gap: 2px;
      width: 16px;
      height: 12px;
    }

    .layout-icon--1 {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }

    .layout-icon--2 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr;
    }

    .layout-icon--4 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }

    .layout-icon-cell {
      background: currentColor;
      border-radius: 1px;
      opacity: 0.6;
    }

    .layout-btn.active .layout-icon-cell {
      opacity: 1;
    }
  `;

  @property({ type: Number })
  mode: ChatLayoutMode = 1;

  private _localeChangeUnsubscribe: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._localeChangeUnsubscribe = onLocaleChanged(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._localeChangeUnsubscribe) {
      this._localeChangeUnsubscribe();
      this._localeChangeUnsubscribe = null;
    }
  }

  private _handleClick(newMode: ChatLayoutMode) {
    if (newMode !== this.mode) {
      this.dispatchEvent(
        new CustomEvent("layout-change", {
          detail: { mode: newMode },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _renderLayoutIcon(mode: ChatLayoutMode) {
    const cells = mode === 1 ? 1 : mode === 2 ? 2 : 4;
    return html`
      <div class="layout-icon layout-icon--${mode}">
        ${Array(cells)
          .fill(0)
          .map(
            () =>
              html`
                <div class="layout-icon-cell"></div>
              `,
          )}
      </div>
    `;
  }

  render() {
    const modes: ChatLayoutMode[] = [1, 2, 4];
    return html`
      <div class="layout-switcher" role="group" aria-label=${t("chat.layoutLabel")}>
        ${modes.map(
          (m) => html`
            <button
              class="layout-btn ${this.mode === m ? "active" : ""}"
              @click=${() => this._handleClick(m)}
              title=${m === 1 ? t("chat.layoutSingle") : m === 2 ? t("chat.layoutDouble") : t("chat.layoutQuad")}
              aria-pressed="${this.mode === m}"
            >
              ${this._renderLayoutIcon(m)}
            </button>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-layout-switcher": ChatLayoutSwitcher;
  }
}
