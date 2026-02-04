import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let lastGatewayClientOpts: unknown;

const loadDebugMock = vi.fn(async () => {});
const loadPresenceMock = vi.fn(async () => {});
const refreshActiveTabMock = vi.fn(async () => {});
const loadChatHistoryMock = vi.fn(async () => {});

vi.mock("./gateway", () => ({
  GatewayBrowserClient: class {
    start = vi.fn();
    stop = vi.fn();
    constructor(opts: unknown) {
      lastGatewayClientOpts = opts;
    }
  },
}));

vi.mock("./controllers/debug", () => ({ loadDebug: loadDebugMock }));
vi.mock("./controllers/presence", () => ({ loadPresence: loadPresenceMock }));

vi.mock("./app-settings", async () => {
  const actual = await vi.importActual<typeof import("./app-settings")>("./app-settings");
  return {
    ...actual,
    refreshActiveTab: refreshActiveTabMock,
  };
});

vi.mock("./controllers/chat", async () => {
  const actual = await vi.importActual<typeof import("./controllers/chat")>("./controllers/chat");
  return {
    ...actual,
    loadChatHistory: loadChatHistoryMock,
  };
});

import { connectGateway } from "./app-gateway";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHost() {
  return {
    settings: {
      gatewayUrl: "ws://example.invalid",
      token: "",
      sessionKey: "main",
      lastActiveSessionKey: "main",
    },
    password: "",
    client: null,
    connected: true,
    hello: null,
    lastError: null,
    eventLogBuffer: [],
    eventLog: [],
    tab: "chat",

    // Fields referenced by the app-gateway host type (not all used in these tests).
    presenceEntries: [],
    presenceError: null,
    presenceStatus: null,
    agentsLoading: false,
    agentsList: null,
    agentsError: null,
    debugHealth: null,
    assistantName: "",
    assistantAvatar: null,
    assistantAgentId: null,
    sessionKey: "main",
    chatRunId: null,
    execApprovalQueue: [],
    execApprovalError: null,
  } as unknown as Parameters<typeof connectGateway>[0];
}

function getOnGap() {
  const opts = lastGatewayClientOpts as {
    onGap?: (info: { expected: number; received: number }) => void;
  };
  if (!opts?.onGap) throw new Error("Expected GatewayBrowserClient onGap option to be set");
  return opts.onGap;
}

describe("app-gateway: event gap self-heal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    lastGatewayClientOpts = undefined;
    loadDebugMock.mockClear();
    loadPresenceMock.mockClear();
    refreshActiveTabMock.mockClear();
    loadChatHistoryMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces self-heal: within 3s multiple gaps only trigger one refresh", async () => {
    const host = createHost();
    connectGateway(host);
    host.connected = true;
    const onGap = getOnGap();

    onGap({ expected: 1, received: 3 });
    await flushMicrotasks();

    onGap({ expected: 2, received: 4 });
    await flushMicrotasks();

    expect(loadDebugMock).toHaveBeenCalledTimes(1);
    expect(loadPresenceMock).toHaveBeenCalledTimes(1);
    expect(refreshActiveTabMock).toHaveBeenCalledTimes(1);
    expect(loadChatHistoryMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3001);
    onGap({ expected: 10, received: 12 });
    await flushMicrotasks();

    expect(loadDebugMock).toHaveBeenCalledTimes(2);
    expect(loadPresenceMock).toHaveBeenCalledTimes(2);
    expect(refreshActiveTabMock).toHaveBeenCalledTimes(2);
    expect(loadChatHistoryMock).toHaveBeenCalledTimes(2);
  });

  it("does not set lastError when self-heal succeeds (option 1)", async () => {
    const host = createHost();
    connectGateway(host);
    host.connected = true;
    const onGap = getOnGap();

    onGap({ expected: 1, received: 3 });
    await flushMicrotasks();

    expect(host.lastError).toBeNull();
    expect(host.eventLogBuffer[0]).toMatchObject({
      event: "gateway.gap",
      payload: { expected: 1, received: 3 },
    });
  });

  it("sets a fallback error only when there is a hard failure", async () => {
    refreshActiveTabMock.mockRejectedValueOnce(new Error("boom"));

    const host = createHost();
    connectGateway(host);
    host.connected = true;
    const onGap = getOnGap();

    onGap({ expected: 1, received: 3 });
    await flushMicrotasks();

    expect(host.lastError).toEqual(expect.any(String));
  });
});
