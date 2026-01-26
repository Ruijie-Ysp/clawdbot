import { formatAgo, formatDurationMs, formatMs } from "./format";
import { t, tp } from "./i18n/index.js";
import type { CronJob, GatewaySessionRow, PresenceEntry } from "./types";

export function formatPresenceSummary(entry: PresenceEntry): string {
  const host = entry.host ?? t("common.unknown");
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
  if (!ms) return t("common.na");
  return `${formatMs(ms)} (${formatAgo(ms)})`;
}

export function formatSessionTokens(row: GatewaySessionRow) {
  if (row.totalTokens == null) return t("common.na");
  const total = row.totalTokens ?? 0;
  const ctx = row.contextTokens ?? 0;
  return ctx ? `${total} / ${ctx}` : String(total);
}

export function formatEventPayload(payload: unknown): string {
  if (payload == null) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
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
    return tp("cron.scheduleAt", { time: formatMs(s.atMs) });
  }
  if (s.kind === "every") {
    return tp("cron.scheduleEvery", { interval: formatDurationMs(s.everyMs) });
  }
  const tz = s.tz ? ` (${s.tz})` : "";
  return tp("cron.scheduleCron", { expr: s.expr, tz });
}

export function formatCronPayload(job: CronJob) {
  const p = job.payload;
  if (p.kind === "systemEvent") return tp("cron.payloadSystem", { text: p.text });
  return tp("cron.payloadAgent", { message: p.message });
}
