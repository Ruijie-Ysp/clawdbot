import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { SignalStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatBool } from "./channels.shared";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t("channels.signal")}</div>
      <div class="card-sub">${t("channels.signalCard.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBool(signal?.configured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBool(signal?.running)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.baseUrl")}</span>
          <span>${signal?.baseUrl ?? t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${signal?.lastStartAt ? formatAgo(signal.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${signal?.lastProbeAt ? formatAgo(signal.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${signal?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${signal.lastError}
          </div>`
        : nothing}

      ${signal?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${signal.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")} ·
            ${signal.probe.status ?? ""} ${signal.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "signal", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
