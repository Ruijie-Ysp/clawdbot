/**
 * i18n helpers for Chat view
 */

import { html, nothing } from "lit";
import { icons } from "../icons.js";
import { t, type Locale } from "../i18n/index.js";

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};

const COMPACTION_TOAST_DURATION_MS = 5000;

export function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined, locale: Locale) {
  if (!status) return nothing;

  // Show "compacting..." while active
  if (status.active) {
    return html`
      <div class="callout info compaction-indicator compaction-indicator--active">
        ${icons.loader} ${t("chat.compacting")}
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div class="callout success compaction-indicator compaction-indicator--complete">
          ${icons.check} ${t("chat.compacted")}
        </div>
      `;
    }
  }

  return nothing;
}

export function getChatPlaceholder(locale: Locale, connected: boolean): string {
  return connected
    ? t("chat.inputPlaceholder")
    : t("chat.disconnected");
}

export function getLoadingText(locale: Locale): string {
  return t("common.loading");
}
