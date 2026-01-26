/**
 * Language switcher component for Clawdbot UI
 */

import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("clawdbot-language-switcher")
export class LanguageSwitcher extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .language-switcher {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .language-select {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color, #333);
      background: var(--bg-color, #1a1a1a);
      color: var(--text-color, #fff);
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .language-select:hover {
      border-color: var(--accent-color, #e85a2e);
    }

    .language-select:focus {
      outline: none;
      border-color: var(--accent-color, #e85a2e);
      box-shadow: 0 0 0 2px rgba(232, 90, 46, 0.3);
    }

    .language-option {
      padding: 4px 8px;
      background: var(--bg-color, #1a1a1a);
      color: var(--text-color, #fff);
    }

    .language-option:hover {
      background: var(--accent-color, #e85a2e);
    }
  `;

  @state()
  private _currentLocale = this.loadLocale();

  @state()
  private _availableLocales = this.getAvailableLocales();

  private readonly LOCALE_STORAGE_KEY = "clawdbot_locale";

  private getDefaultLocale(): string {
    const stored = localStorage.getItem(this.LOCALE_STORAGE_KEY);
    if (stored && (stored === "en" || stored === "zh-CN")) {
      return stored;
    }

    const browserLang = navigator.language;
    if (browserLang.startsWith("zh")) {
      return "zh-CN";
    }

    return "en";
  }

  private loadLocale(): string {
    return this.getDefaultLocale();
  }

  private saveLocale(locale: string): void {
    localStorage.setItem(this.LOCALE_STORAGE_KEY, locale);
    this._currentLocale = locale;
    // Reload to apply changes
    window.location.reload();
  }

  private getAvailableLocales(): Array<{ code: string; native: string }> {
    return [
      { code: "en", native: "English" },
      { code: "zh-CN", native: "简体中文" },
    ];
  }

  private _handleLocaleChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const newLocale = select.value;
    if (newLocale !== this._currentLocale) {
      this.saveLocale(newLocale);
    }
  }

  render() {
    return html`
      <div class="language-switcher">
        <select
          class="language-select"
          .value="${this._currentLocale}"
          @change="${this._handleLocaleChange}"
          aria-label="Language"
        >
          ${this._availableLocales.map(
            (locale) => html`
              <option class="language-option" value="${locale.code}">
                ${locale.native}
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
    "clawdbot-language-switcher": LanguageSwitcher;
  }
}
