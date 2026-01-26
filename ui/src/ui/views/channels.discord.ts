import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { DiscordStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatBool } from "./channels.shared";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t("channels.discord")}</div>
      <div class="card-sub">${t("channels.discordCard.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${formatBool(discord?.configured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${formatBool(discord?.running)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${discord?.lastStartAt ? formatAgo(discord.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${discord?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${discord.lastError}
          </div>`
        : nothing}

      ${discord?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${discord.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")} ·
            ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "discord", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
