import { fetchWithSsrFGuard } from "openclaw/plugin-sdk/infra-runtime";

export type GuardedFetchArgs = {
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function guardedFetch(args: GuardedFetchArgs): Promise<Response> {
  const { response, release } = await fetchWithSsrFGuard({
    url: args.url,
    init: args.init,
    timeoutMs: args.timeoutMs,
    signal: args.signal,
  });
  try {
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    await release();
  }
}
