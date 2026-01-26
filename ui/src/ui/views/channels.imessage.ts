import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { IMessageStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatBool } from "./channels.shared";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t("channels.imessage")}</div>
      <div class="card-sub">${t("channels.imessageCard.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBool(imessage?.configured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBool(imessage?.running)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${imessage?.lastStartAt ? formatAgo(imessage.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${imessage?.lastProbeAt ? formatAgo(imessage.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${imessage?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${imessage.lastError}
          </div>`
        : nothing}

      ${imessage?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${imessage.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")} ·
            ${imessage.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
