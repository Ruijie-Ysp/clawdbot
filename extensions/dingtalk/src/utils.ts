import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Logger, RetryOptions } from "./types.js";

/**
 * Mask sensitive fields in data for safe logging
 * Prevents PII leakage in debug logs
 */
export function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  const masked = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const sensitiveFields = new Set(["token", "accessToken", "clientSecret", "secret"]);

  function maskObj(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (sensitiveFields.has(key)) {
        const val = obj[key];
        if (typeof val === "string" && val.length > 6) {
          obj[key] = val.slice(0, 3) + "*".repeat(val.length - 6) + val.slice(-3);
        } else if (typeof val === "string") {
          obj[key] = "*".repeat(val.length);
        }
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        maskObj(obj[key] as Record<string, unknown>);
      }
    }
  }

  maskObj(masked);
  return masked;
}

/**
 * Cleanup orphaned temp files from dingtalk media
 * Run at startup to clean up files from crashed processes
 */
export function cleanupOrphanedTempFiles(log?: Logger): number {
  const tempDir = os.tmpdir();
  const dingtalkPattern = /^dingtalk_\d+\..+$/;
  let cleaned = 0;

  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!dingtalkPattern.test(file)) {
        continue;
      }

      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
          log?.debug?.(`[DingTalk] Cleaned up orphaned temp file: ${file}`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log?.debug?.(`[DingTalk] Failed to cleanup temp file ${file}: ${errMsg}`);
      }
    }

    if (cleaned > 0) {
      log?.info?.(`[DingTalk] Cleaned up ${cleaned} orphaned temp files`);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.debug?.(`[DingTalk] Failed to cleanup temp directory: ${errMsg}`);
  }

  return cleaned;
}

/**
 * Retry logic for API calls with exponential backoff
 * Handles transient failures like 401 token expiry
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 100, log } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      const statusCode = error.response?.status;
      const isRetryable =
        statusCode === 401 || statusCode === 429 || (statusCode && statusCode >= 500);

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      log?.debug?.(`[DingTalk] Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Retry exhausted without returning");
}
