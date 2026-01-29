import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { formatAgo } from "../format";
import { t, tp } from "../i18n/index.js";
import { icons } from "../icons";
import type { GatewaySessionRow, SessionsListResult } from "../types";

export type SessionsSidebarProps = {
  open: boolean;
  loading: boolean;
  sessions: SessionsListResult | null;
  currentSessionKey: string;
  searchQuery: string;
  editingSessionKey: string | null;
  editingLabel: string;
  onToggle: () => void;
  onSessionSelect: (key: string) => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onNewSession: () => void;
  onStartEdit: (key: string, currentLabel: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (key: string, newLabel: string) => void;
  onEditLabelChange: (value: string) => void;
};

function filterSessions(
  sessions: GatewaySessionRow[],
  query: string,
): GatewaySessionRow[] {
  if (!query.trim()) return sessions;
  const lower = query.toLowerCase();
  return sessions.filter((s) => {
    const name = (s.displayName ?? s.key).toLowerCase();
    const label = (s.label ?? "").toLowerCase();
    const subject = (s.subject ?? "").toLowerCase();
    return name.includes(lower) || label.includes(lower) || subject.includes(lower);
  });
}

type SessionItemContext = {
  session: GatewaySessionRow;
  isCurrent: boolean;
  isEditing: boolean;
  editingLabel: string;
  onSelect: (key: string) => void;
  onStartEdit: (key: string, currentLabel: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (key: string, newLabel: string) => void;
  onEditLabelChange: (value: string) => void;
};

function renderSessionItem(ctx: SessionItemContext) {
  const { session, isCurrent, isEditing, editingLabel } = ctx;
  const displayLabel = session.label?.trim();
  // Priority: label > subject > displayName > shortened key
  let displayName = displayLabel || session.subject?.trim() || session.displayName;
  if (!displayName) {
    // Shorten the session key for display (e.g., "session-1769478..." -> "会话 1769478...")
    const key = session.key;
    const match = key.match(/session-(\d+)/);
    if (match) {
      displayName = `会话 ${match[1].slice(0, 6)}...`;
    } else {
      displayName = key;
    }
  }
  const updated = session.updatedAt ? formatAgo(session.updatedAt) : "";
  const kindBadge = session.kind !== "unknown" ? session.kind : "";

  if (isEditing) {
    // Use a ref-like approach to get the input value on save
    // This avoids issues with Chinese IME composition
    const handleSave = (e: Event) => {
      const input = (e.currentTarget as HTMLElement)
        .closest(".sessions-sidebar__item--editing")
        ?.querySelector("input") as HTMLInputElement | null;
      if (input) {
        ctx.onSaveEdit(session.key, input.value);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const input = e.target as HTMLInputElement;
        ctx.onSaveEdit(session.key, input.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        ctx.onCancelEdit();
      }
    };

    return html`
      <div class="sessions-sidebar__item sessions-sidebar__item--editing ${isCurrent ? "sessions-sidebar__item--active" : ""}">
        <input
          type="text"
          class="sessions-sidebar__edit-input"
          .value=${editingLabel}
          @keydown=${handleKeydown}
          placeholder=${t("sessionsSidebar.namePlaceholder")}
        />
        <div class="sessions-sidebar__edit-actions">
          <button
            class="btn btn--xs btn--icon"
            @click=${handleSave}
            title=${t("common.save")}
          >
            ${icons.check}
          </button>
          <button
            class="btn btn--xs btn--icon"
            @click=${ctx.onCancelEdit}
            title=${t("common.cancel")}
          >
            ${icons.x}
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div
      class="sessions-sidebar__item ${isCurrent ? "sessions-sidebar__item--active" : ""}"
      title=${session.key}
    >
      <button
        class="sessions-sidebar__item-content"
        @click=${() => ctx.onSelect(session.key)}
      >
        <div class="sessions-sidebar__item-main">
          <span class="sessions-sidebar__item-name">${displayName}</span>
        </div>
        <div class="sessions-sidebar__item-meta">
          ${kindBadge
            ? html`<span class="sessions-sidebar__item-kind">${kindBadge}</span>`
            : nothing}
          ${updated
            ? html`<span class="sessions-sidebar__item-time">${updated}</span>`
            : nothing}
        </div>
      </button>
      <button
        class="sessions-sidebar__item-edit btn btn--xs btn--icon"
        @click=${(e: Event) => {
          e.stopPropagation();
          ctx.onStartEdit(session.key, session.label ?? "");
        }}
        title=${t("sessionsSidebar.rename")}
      >
        ${icons.edit}
      </button>
    </div>
  `;
}

export function renderSessionsSidebar(props: SessionsSidebarProps) {
  const sessions = props.sessions?.sessions ?? [];
  const filtered = filterSessions(sessions, props.searchQuery);

  // Toggle button (always visible)
  const toggleButton = html`
    <button
      class="sessions-sidebar__toggle ${props.open ? "sessions-sidebar__toggle--open" : ""}"
      @click=${props.onToggle}
      title=${props.open ? t("sessionsSidebar.collapse") : t("sessionsSidebar.expand")}
    >
      ${props.open ? icons.chevronLeft : icons.menu}
    </button>
  `;

  if (!props.open) {
    return html`<div class="sessions-sidebar sessions-sidebar--collapsed">${toggleButton}</div>`;
  }

  return html`
    <div class="sessions-sidebar sessions-sidebar--open">
      <div class="sessions-sidebar__header">
        ${toggleButton}
        <span class="sessions-sidebar__title">${t("sessionsSidebar.title")}</span>
        <div class="sessions-sidebar__actions">
          <button
            class="btn btn--sm btn--icon"
            @click=${props.onNewSession}
            title=${t("chat.newSession")}
          >
            ${icons.plus}
          </button>
          <button
            class="btn btn--sm btn--icon"
            ?disabled=${props.loading}
            @click=${props.onRefresh}
            title=${t("common.refresh")}
          >
            ${icons.refresh}
          </button>
        </div>
      </div>

      <div class="sessions-sidebar__search">
        <input
          type="text"
          placeholder=${t("sessionsSidebar.searchPlaceholder")}
          .value=${props.searchQuery}
          @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="sessions-sidebar__list">
        ${props.loading
          ? html`<div class="sessions-sidebar__loading">${t("common.loading")}</div>`
          : filtered.length === 0
            ? html`<div class="sessions-sidebar__empty">
                ${props.searchQuery
                  ? t("sessionsSidebar.noResults")
                  : t("sessions.noSessions")}
              </div>`
            : repeat(
                filtered,
                (s) => s.key,
                (s) => renderSessionItem({
                  session: s,
                  isCurrent: s.key === props.currentSessionKey,
                  isEditing: s.key === props.editingSessionKey,
                  editingLabel: props.editingLabel,
                  onSelect: props.onSessionSelect,
                  onStartEdit: props.onStartEdit,
                  onCancelEdit: props.onCancelEdit,
                  onSaveEdit: props.onSaveEdit,
                  onEditLabelChange: props.onEditLabelChange,
                }),
              )}
      </div>

      <div class="sessions-sidebar__footer">
        <span class="sessions-sidebar__count">
          ${tp("sessionsSidebar.count", { count: String(filtered.length) })}
        </span>
      </div>
    </div>
  `;
}

