import { html, nothing } from "lit";
import type { GoogleChatStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatAgo } from "../format.ts";
import { t } from "../i18n/index.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

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
          <span>
            ${
              googleChat
                ? googleChat.configured
                  ? t("common.yes")
                  : t("common.no")
                : t("common.na")
            }
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.running")}</span>
          <span>
            ${googleChat ? (googleChat.running ? t("common.yes") : t("common.no")) : t("common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.credential")}</span>
          <span>${googleChat?.credentialSource ?? t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.audience")}</span>
          <span>
            ${
              googleChat?.audienceType
                ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
                : t("common.na")
            }
          </span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastStart")}</span>
          <span>${formatAgo(googleChat?.lastStartAt ?? null)}</span>
        </div>
        <div>
          <span class="label">${t("channels.labels.lastProbe")}</span>
          <span>${formatAgo(googleChat?.lastProbeAt ?? null)}</span>
        </div>
      </div>

      ${
        googleChat?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${googleChat.lastError}
          </div>`
          : nothing
      }

      ${
        googleChat?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${
              googleChat.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")
            } ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
