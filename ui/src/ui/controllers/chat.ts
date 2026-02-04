import type { GatewayBrowserClient } from "../gateway.ts";
import type { ChatAttachment } from "../ui-types.ts";
import { extractText } from "../chat/message-extract.ts";
import { t, tp } from "../i18n/index.js";
import {
  compressImageDataUrlForGateway,
  ImageCompressionError,
  estimateDecodedBytesFromDataUrl,
} from "../media/image-compress.ts";
import { generateUUID } from "../uuid.ts";

export type ChatState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatThinkingLevel: string | null;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatRunId: string | null;
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  lastError: string | null;
};

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

export async function loadChatHistory(state: ChatState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.chatLoading = true;
  state.lastError = null;
  try {
    const res = await state.client.request<{ messages?: Array<unknown>; thinkingLevel?: string }>(
      "chat.history",
      {
        sessionKey: state.sessionKey,
        limit: 200,
      },
    );
    state.chatMessages = Array.isArray(res.messages) ? res.messages : [];
    state.chatThinkingLevel = res.thinkingLevel ?? null;
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.chatLoading = false;
  }
}

function dataUrlToBase64(dataUrl: string): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}

export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[],
): Promise<string | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  const msg = message.trim();
  const hasAttachments = attachments && attachments.length > 0;
  if (!msg && !hasAttachments) {
    return null;
  }

  const now = Date.now();

  // Gateway hard limit: 5MB decoded bytes per image.
  const GATEWAY_ATTACHMENT_MAX_BYTES = 5_000_000;

  // Build user message content blocks
  const contentBlocks: Array<{ type: string; text?: string; source?: unknown }> = [];
  if (msg) {
    contentBlocks.push({ type: "text", text: msg });
  }
  // Add image previews to the message for display
  if (hasAttachments) {
    for (const att of attachments) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mimeType, data: att.dataUrl },
      });
    }
  }

  state.chatMessages = [
    ...state.chatMessages,
    {
      role: "user",
      content: contentBlocks,
      timestamp: now,
    },
  ];

  state.chatSending = true;
  state.lastError = null;

  // Track the runId created by *this* send attempt so we don't accidentally clear
  // an unrelated in-flight run if something fails before runId is created.
  let runId: string | null = null;

  try {
    // Convert attachments to API format, with best-effort client-side compression
    // to stay within the Gateway's 5MB per-image limit.
    let apiAttachments: Array<{ type: "image"; mimeType: string; content: string }> | undefined;
    if (hasAttachments) {
      apiAttachments = [];
      for (const att of attachments) {
        const approx = estimateDecodedBytesFromDataUrl(att.dataUrl);
        const needsCompress = typeof approx === "number" && approx > GATEWAY_ATTACHMENT_MAX_BYTES;
        const prepared = needsCompress
          ? await compressImageDataUrlForGateway(att.dataUrl, {
              maxBytes: GATEWAY_ATTACHMENT_MAX_BYTES,
              maxEdge: 2048,
              outputMimeType: "image/jpeg",
            })
          : {
              dataUrl: att.dataUrl,
              mimeType: att.mimeType,
              sizeBytes: approx ?? 0,
              changed: false,
            };

        const parsed = dataUrlToBase64(prepared.dataUrl);
        if (!parsed) {
          throw new ImageCompressionError("decode_failed", "Invalid image data URL");
        }
        apiAttachments.push({
          type: "image",
          mimeType: parsed.mimeType,
          content: parsed.content,
        });
      }
    }

    runId = generateUUID();
    state.chatRunId = runId;
    state.chatStream = "";
    state.chatStreamStartedAt = now;

    await state.client.request("chat.send", {
      sessionKey: state.sessionKey,
      message: msg,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments,
    });
    return runId;
  } catch (err) {
    const error = String(err);
    if (runId && state.chatRunId === runId) {
      state.chatRunId = null;
      state.chatStream = null;
      state.chatStreamStartedAt = null;
    }
    if (err instanceof ImageCompressionError) {
      if (err.code === "unsupported_format") {
        state.lastError = t("chat.attachmentFormatUnsupported");
      } else if (err.code === "too_large") {
        state.lastError = t("chat.attachmentTooLarge");
      } else {
        state.lastError = t("chat.attachmentProcessingFailed");
      }
    } else {
      state.lastError = error;
    }
    state.chatMessages = [
      ...state.chatMessages,
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: tp("chat.errorMessage", {
              error: state.lastError ?? error,
            }),
          },
        ],
        timestamp: Date.now(),
      },
    ];
    return null;
  } finally {
    state.chatSending = false;
  }
}

export async function abortChatRun(state: ChatState): Promise<boolean> {
  if (!state.client || !state.connected) {
    return false;
  }
  const runId = state.chatRunId;
  try {
    await state.client.request(
      "chat.abort",
      runId ? { sessionKey: state.sessionKey, runId } : { sessionKey: state.sessionKey },
    );
    return true;
  } catch (err) {
    state.lastError = String(err);
    return false;
  }
}

export function handleChatEvent(state: ChatState, payload?: ChatEventPayload) {
  if (!payload) {
    return null;
  }
  if (payload.sessionKey !== state.sessionKey) {
    return null;
  }

  // Final from another run (e.g. sub-agent announce): refresh history to show new message.
  // See https://github.com/openclaw/openclaw/issues/1909
  if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId) {
    if (payload.state === "final") {
      return "final";
    }
    return null;
  }

  if (payload.state === "delta") {
    const next = extractText(payload.message);
    if (typeof next === "string") {
      const current = state.chatStream ?? "";
      if (!current || next.length >= current.length) {
        state.chatStream = next;
      }
    }
  } else if (payload.state === "final") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "aborted") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  } else if (payload.state === "error") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
    state.lastError = payload.errorMessage ?? "chat error";
  }
  return payload.state;
}
