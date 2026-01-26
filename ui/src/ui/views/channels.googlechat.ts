import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { GoogleChatStatus } from "../types";
import { renderChannelConfigSection } from "./channels.config";
import type { ChannelsProps } from "./channels.types";
import { formatBool } from "./channels.shared";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t("channels.googleChat")}</div>
      <div class="card-sub">${t("channels.googleChatCard.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.labels.configured")}</span>
          <span>${googleChat ? formatBool(googleChat.configured) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>${googleChat ? formatBool(googleChat.running) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.credential")}</span>
          <span>${googleChat?.credentialSource ?? t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.audience")}</span>
          <span>
            ${googleChat?.audienceType
              ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
              : t("common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${googleChat?.lastStartAt ? formatAgo(googleChat.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${googleChat?.lastProbeAt ? formatAgo(googleChat.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${googleChat?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${googleChat.lastError}
          </div>`
        : nothing}

      ${googleChat?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${googleChat.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")} ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
