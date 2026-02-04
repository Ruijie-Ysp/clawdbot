import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayBrowserClient, GatewayHelloOk } from "../gateway.ts";
import type { UiSettings } from "../storage.ts";
import type { ResolvedTheme, ThemeMode } from "../theme.ts";
import type { SessionsListResult } from "../types.ts";
import type { ChatAttachment, ChatQueueItem } from "../ui-types.ts";
import { parseAgentSessionKey } from "../../../../src/routing/session-key.js";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
  refreshChatAvatar as refreshChatAvatarInternal,
} from "../app-chat.ts";
import {
  handleChatScroll as handleChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal,
  resetChatScroll as resetChatScrollInternal,
} from "../app-scroll.ts";
import {
  resetToolStream as resetToolStreamInternal,
  type CompactionStatus,
  type ToolStreamEntry,
} from "../app-tool-stream.ts";
import { registerChatPanel } from "../chat-panel-registry.ts";
import { loadChatHistory } from "../controllers/chat.ts";
import { generateUUID } from "../uuid.ts";
import { renderChat } from "../views/chat.ts";

@customElement("openclaw-chat-panel")
export class OpenClawChatPanel extends LitElement {
  @property({ type: Number })
  panelIndex = 0;

  @property({ type: String })
  sessionKey = "main";

  @property({ type: String })
  agentId = "main";

  @property({ attribute: false })
  client: GatewayBrowserClient | null = null;

  @property({ type: Boolean })
  connected = false;

  @property({ attribute: false })
  hello: GatewayHelloOk | null = null;

  @property({ type: String })
  basePath = "";

  @property({ type: Boolean })
  showThinking = true;

  @property({ attribute: false })
  sessions: SessionsListResult | null = null;

  @property({ type: Boolean })
  focusMode = false;

  @property({ attribute: false })
  onToggleFocusMode?: () => void;

  @property({ type: String })
  disabledReason: string | null = null;

  @property({ type: Number })
  splitRatio = 0.6;

  @property({ attribute: false })
  onSplitRatioChange?: (ratio: number) => void;

  @property({ attribute: false })
  onSessionKeyPersist?: (panelIndex: number, sessionKey: string) => void;

  @property({ type: String })
  assistantName = "";

  @property({ type: String })
  assistantAvatar: string | null = null;

  @property({ attribute: false })
  settings: UiSettings | null = null;

  @property({ type: String })
  theme: ThemeMode = "system";

  @property({ type: String })
  themeResolved: ResolvedTheme = "dark";

  @property({ type: String })
  applySessionKey = "";

  @state()
  chatLoading = false;

  @state()
  chatMessages: unknown[] = [];

  @state()
  chatToolMessages: unknown[] = [];

  @state()
  chatStream: string | null = null;

  @state()
  chatStreamStartedAt: number | null = null;

  @state()
  chatRunId: string | null = null;

  @state()
  chatThinkingLevel: string | null = null;

  @state()
  chatSending = false;

  @state()
  chatMessage = "";

  @state()
  chatAttachments: ChatAttachment[] = [];

  @state()
  chatQueue: ChatQueueItem[] = [];

  @state()
  lastError: string | null = null;

  @state()
  chatAvatarUrl: string | null = null;

  @state()
  compactionStatus: CompactionStatus | null = null;

  @state()
  sidebarOpen = false;

  @state()
  sidebarContent: string | null = null;

  @state()
  sidebarError: string | null = null;

  toolStreamById = new Map<string, ToolStreamEntry>();
  toolStreamOrder: string[] = [];
  toolStreamSyncTimer: number | null = null;
  compactionClearTimer: number | null = null;
  refreshSessionsAfterChat = new Set<string>();
  chatScrollFrame: number | null = null;
  chatScrollTimeout: number | null = null;
  chatHasAutoScrolled = false;
  chatUserNearBottom = true;
  logsScrollFrame: number | null = null;
  logsAtBottom = true;
  topbarObserver: ResizeObserver | null = null;

  private unregisterPanel: (() => void) | null = null;
  private sidebarCloseTimer: number | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.unregisterPanel = registerChatPanel(this);
    if (this.connected) {
      void this.refreshChat();
    }
  }

  disconnectedCallback() {
    this.unregisterPanel?.();
    this.unregisterPanel = null;
    this.clearTimers();
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has("panelIndex")) {
      this.unregisterPanel?.();
      this.unregisterPanel = registerChatPanel(this);
    }
    if (changed.has("sessionKey")) {
      this.resetPanelState();
      if (this.connected) {
        void this.refreshChat();
      }
    }
    if ((changed.has("connected") || changed.has("client")) && this.connected) {
      void this.refreshChat();
    }
  }

  private clearTimers() {
    if (this.toolStreamSyncTimer != null) {
      clearTimeout(this.toolStreamSyncTimer);
      this.toolStreamSyncTimer = null;
    }
    if (this.chatScrollFrame) {
      cancelAnimationFrame(this.chatScrollFrame);
      this.chatScrollFrame = null;
    }
    if (this.chatScrollTimeout != null) {
      clearTimeout(this.chatScrollTimeout);
      this.chatScrollTimeout = null;
    }
    if (this.compactionClearTimer != null) {
      clearTimeout(this.compactionClearTimer);
      this.compactionClearTimer = null;
    }
    if (this.sidebarCloseTimer != null) {
      clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
  }

  private resetPanelState() {
    this.chatMessage = "";
    this.chatAttachments = [];
    this.chatStream = null;
    this.chatStreamStartedAt = null;
    this.chatRunId = null;
    this.chatQueue = [];
    this.chatMessages = [];
    this.chatToolMessages = [];
    this.chatThinkingLevel = null;
    this.lastError = null;
    this.chatAvatarUrl = null;
    this.compactionStatus = null;
    this.sidebarOpen = false;
    this.sidebarContent = null;
    this.sidebarError = null;
    resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
  }

  private async refreshChat() {
    await Promise.all([
      loadChatHistory(this),
      refreshChatAvatarInternal(this as unknown as Parameters<typeof refreshChatAvatarInternal>[0]),
    ]);
    scheduleChatScrollInternal(
      this as unknown as Parameters<typeof scheduleChatScrollInternal>[0],
      !this.chatHasAutoScrolled,
    );
  }

  private updateSessionKey(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === this.sessionKey) {
      return;
    }
    this.sessionKey = trimmed;
    this.onSessionKeyPersist?.(this.panelIndex, trimmed);
  }

  private async handleCreateNewSession() {
    const parsed = parseAgentSessionKey(this.sessionKey);
    const agentId = parsed?.agentId ?? this.agentId ?? "main";
    const timestamp = Date.now();
    const shortId = generateUUID().slice(0, 8);
    const newKey = `agent:${agentId}:session-${timestamp}-${shortId}`;

    if (this.client && this.connected) {
      try {
        await this.client.request("sessions.patch", { key: newKey });
      } catch {
        // Best-effort: continue even if registration fails.
      }
    }

    this.updateSessionKey(newKey);
  }

  private handleFallbackToMain() {
    const parsed = parseAgentSessionKey(this.sessionKey);
    const agentId = parsed?.agentId ?? this.agentId ?? "main";
    const mainKey = `agent:${agentId}:main`;
    this.lastError = null;
    this.updateSessionKey(mainKey);
  }

  private handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  private handleCloseSidebar() {
    this.sidebarOpen = false;
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  private handleSplitRatioChange(ratio: number) {
    const next = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = next;
    this.onSplitRatioChange?.(next);
  }

  private handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  private async handleSendChat() {
    await handleSendChatInternal(this as unknown as Parameters<typeof handleSendChatInternal>[0]);
  }

  private async handleAbortChat() {
    await handleAbortChatInternal(this as unknown as Parameters<typeof handleAbortChatInternal>[0]);
  }

  private removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  render() {
    return html`
      ${renderChat({
        sessionKey: this.sessionKey,
        onSessionKeyChange: (next: string) => this.updateSessionKey(next),
        thinkingLevel: this.chatThinkingLevel,
        showThinking: this.showThinking,
        loading: this.chatLoading,
        sending: this.chatSending,
        compactionStatus: this.compactionStatus,
        assistantAvatarUrl: this.chatAvatarUrl,
        messages: this.chatMessages,
        toolMessages: this.chatToolMessages,
        stream: this.chatStream,
        streamStartedAt: this.chatStreamStartedAt,
        draft: this.chatMessage,
        queue: this.chatQueue,
        connected: this.connected,
        canSend: this.connected,
        disabledReason: this.disabledReason,
        error: this.lastError,
        sessions: this.sessions,
        focusMode: this.focusMode,
        onRefresh: () => {
          resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
          return this.refreshChat();
        },
        onToggleFocusMode: () => this.onToggleFocusMode?.(),
        onChatScroll: (event: Event) => this.handleChatScroll(event),
        onDraftChange: (next: string) => (this.chatMessage = next),
        attachments: this.chatAttachments,
        onAttachmentsChange: (next: ChatAttachment[]) => (this.chatAttachments = next),
        onSend: () => this.handleSendChat(),
        canAbort: Boolean(this.chatRunId),
        onAbort: () => this.handleAbortChat(),
        onQueueRemove: (id: string) => this.removeQueuedMessage(id),
        onNewSession: () => this.handleCreateNewSession(),
        sidebarOpen: this.sidebarOpen,
        sidebarContent: this.sidebarContent,
        sidebarError: this.sidebarError,
        splitRatio: this.splitRatio,
        onOpenSidebar: (content: string) => this.handleOpenSidebar(content),
        onCloseSidebar: () => this.handleCloseSidebar(),
        onSplitRatioChange: (ratio: number) => this.handleSplitRatioChange(ratio),
        assistantName: this.assistantName,
        assistantAvatar: this.assistantAvatar,
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "openclaw-chat-panel": OpenClawChatPanel;
  }
}
