/**
 * Language switcher component for Clawdbot UI
 */

import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getLocale, setLocale, getAvailableLocales, onLocaleChanged } from "../i18n/index.js";

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

    .language-label {
      font-size: 12px;
      color: var(--text-secondary-color, #888);
      white-space: nowrap;
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
      min-width: 120px;
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

    .language-flag {
      display: inline-block;
      margin-right: 6px;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .language-label {
        display: none;
      }
      
      .language-select {
        min-width: 100px;
      }
    }
  `;

  @state()
  private _currentLocale = getLocale();

  @state()
  private _availableLocales = getAvailableLocales();

  private _localeChangeUnsubscribe: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._currentLocale = getLocale();
    this._availableLocales = getAvailableLocales();
    // Subscribe to locale changes
    this._localeChangeUnsubscribe = onLocaleChanged((locale) => {
      this._currentLocale = locale;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Unsubscribe from locale changes
    if (this._localeChangeUnsubscribe) {
      this._localeChangeUnsubscribe();
      this._localeChangeUnsubscribe = null;
    }
  }

  private _handleLocaleChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const newLocale = select.value;
    if (newLocale !== this._currentLocale) {
      setLocale(newLocale as any);
      // Note: No need to reload page - components should react to locale changes
    }
  }

  // Get flag emoji for locale
  private _getFlagEmoji(localeCode: string): string {
    const flagMap: Record<string, string> = {
      "en": "🇺🇸", // US flag for English
      "zh-CN": "🇨🇳", // China flag for Simplified Chinese
      "zh-TW": "🇹🇼", // Taiwan flag for Traditional Chinese
      "ja": "🇯🇵", // Japan flag for Japanese
      "ko": "🇰🇷", // South Korea flag for Korean
      "fr": "🇫🇷", // France flag for French
      "de": "🇩🇪", // Germany flag for German
      "es": "🇪🇸", // Spain flag for Spanish
      "ru": "🇷🇺", // Russia flag for Russian
      "pt": "🇵🇹", // Portugal flag for Portuguese
      "it": "🇮🇹", // Italy flag for Italian
    };
    
    return flagMap[localeCode] || "🌐";
  }

  render() {
    return html`
      <div class="language-switcher">
        <span class="language-label">🌐</span>
        <select
          class="language-select"
          @change=${this._handleLocaleChange}
          aria-label="Language"
          title="Select language"
        >
          ${this._availableLocales.map(
            (locale) => html`
              <option
                class="language-option"
                value=${locale.code}
                ?selected=${locale.code === this._currentLocale}
              >
                ${this._getFlagEmoji(locale.code)} ${locale.native} (${locale.name})
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
