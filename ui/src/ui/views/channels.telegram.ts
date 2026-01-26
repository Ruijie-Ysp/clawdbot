import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatBool } from "./channels.shared";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = telegramAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("channels.labels.running")}</span>
            <span>${formatBool(account.running)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.configured")}</span>
            <span>${formatBool(account.configured)}</span>
          </div>
          <div>
            <span class="label">${t("channels.labels.lastInbound")}</span>
            <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : t("common.na")}</span>
          </div>
          ${account.lastError
            ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">${t("channels.telegram")}</div>
      <div class="card-sub">${t("channels.telegramCard.subtitle")}</div>
      ${accountCountLabel}

      ${hasMultipleAccounts
        ? html`
            <div class="account-card-list">
              ${telegramAccounts.map((account) => renderAccountCard(account))}
            </div>
          `
        : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">${t("channels.labels.configured")}</span>
                <span>${formatBool(telegram?.configured)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.running")}</span>
                <span>${formatBool(telegram?.running)}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.mode")}</span>
                <span>${telegram?.mode ?? t("common.na")}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.lastStart")}</span>
                <span>${telegram?.lastStartAt ? formatAgo(telegram.lastStartAt) : t("common.na")}</span>
              </div>
              <div>
                <span class="label">${t("channels.labels.lastProbe")}</span>
                <span>${telegram?.lastProbeAt ? formatAgo(telegram.lastProbeAt) : t("common.na")}</span>
              </div>
            </div>
          `}

      ${telegram?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${telegram.lastError}
          </div>`
        : nothing}

      ${telegram?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe.action")} ${telegram.probe.ok ? t("channels.probe.ok") : t("channels.probe.failed")} ·
            ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "telegram", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe.action")}
        </button>
      </div>
    </div>
  `;
}
