import type { CronJob, GatewaySessionRow, PresenceEntry } from "./types.ts";
import { formatAgo, formatDurationMs, formatMs } from "./format.ts";
import { hasTranslation, t, tp } from "./i18n/index.ts";

function resolveDeliveryModeLabel(mode?: string | null): string {
  if (!mode) {
    return "";
  }
  const key = `cron.deliveryModes.${mode}`;
  return hasTranslation(key) ? t(key) : mode;
}

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? t("instances.unknownHost");
  const ip = entry.ip ? `(${entry.ip})` : "";
  const mode = entry.mode ?? "";
  const version = entry.version ?? "";
  return `${host} ${ip} ${mode} ${version}`.trim();
}

export function formatPresenceAge(entry: PresenceEntry): string {
  const ts = entry.ts ?? null;
  return ts ? formatAgo(ts) : t("common.na");
}

export function formatNextRun(ms?: number | null) {
  if (!ms) {
    return t("common.na");
  }
  return `${formatMs(ms)} (${formatAgo(ms)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) {
    return t("common.na");
  }
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}

export function formatEventPayload(payload: unknown): string {
  if (payload == null) {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    // oxlint-disable typescript/no-base-to-string
    return String(payload);
  }
}

export function formatCronState(job: CronJob) {
  const state = job.state ?? {};
  const next = state.nextRunAtMs ? formatMs(state.nextRunAtMs) : t("common.na");
  const last = state.lastRunAtMs ? formatMs(state.lastRunAtMs) : t("common.na");
  const status = state.lastStatus ?? t("common.na");
  return tp("cron.stateSummary", { status, next, last });
}

export function formatCronSchedule(job: CronJob) {
  const s = job.schedule;
  if (s.kind === "at") {
    const atMs = Date.parse(s.at);
    const time = Number.isFinite(atMs) ? formatMs(atMs) : s.at;
    return tp("cron.scheduleAt", { time });
  }
  if (s.kind === "every") {
    return tp("cron.scheduleEvery", { interval: formatDurationMs(s.everyMs) });
  }
  return tp("cron.scheduleCron", { expr: s.expr, tz: s.tz ? ` (${s.tz})` : "" });
}

export function formatCronPayload(job: CronJob) {
  const p = job.payload;
  if (p.kind === "systemEvent") {
    return tp("cron.payloadSystem", { text: p.text });
  }
  const base = tp("cron.payloadAgent", { message: p.message });
  const delivery = job.delivery;
  if (delivery && delivery.mode !== "none") {
    const mode = resolveDeliveryModeLabel(delivery.mode);
    const channelValue = delivery.channel ?? "last";
    const channelLabel = channelValue === "last" ? t("cron.channelLast") : channelValue;
    const target =
      delivery.channel || delivery.to
        ? ` (${channelLabel}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";
    return `${base} · ${mode}${target}`;
  }
  return base;
}
