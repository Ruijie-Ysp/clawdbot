export type ImageCompressionErrorCode =
  | "unsupported_format"
  | "decode_failed"
  | "encode_failed"
  | "too_large";

export class ImageCompressionError extends Error {
  code: ImageCompressionErrorCode;

  constructor(code: ImageCompressionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function dataUrlToBase64(dataUrl: string): { mimeType: string; content: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], content: match[2] };
}

export function estimateDecodedBytesFromBase64(content: string): number {
  // RFC 4648: each 4 chars => 3 bytes, minus padding.
  const len = content.length;
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

export function estimateDecodedBytesFromDataUrl(dataUrl: string): number | null {
  const parsed = dataUrlToBase64(dataUrl);
  if (!parsed) return null;
  return estimateDecodedBytesFromBase64(parsed.content);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function decodeToDrawable(
  dataUrl: string,
  blob: Blob,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  // Prefer ImageBitmap (fast, supports many formats), but fall back to <img> for compatibility.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through.
    }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image decode failed"));
    el.src = dataUrl;
  });
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => {},
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("canvas.toBlob returned null"));
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function compressImageDataUrlForGateway(
  dataUrl: string,
  opts: { maxBytes: number; maxEdge: number; outputMimeType: "image/jpeg" },
): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number; changed: boolean }> {
  const parsed = dataUrlToBase64(dataUrl);
  if (!parsed) {
    throw new ImageCompressionError("decode_failed", "Invalid data URL");
  }

  // Quick path: already under limit.
  const approxBytes = estimateDecodedBytesFromBase64(parsed.content);
  if (approxBytes > 0 && approxBytes <= opts.maxBytes) {
    return { dataUrl, mimeType: parsed.mimeType, sizeBytes: approxBytes, changed: false };
  }

  const srcMime = parsed.mimeType.toLowerCase();
  if (srcMime.includes("heic") || srcMime.includes("heif")) {
    throw new ImageCompressionError("unsupported_format", `Unsupported image format: ${srcMime}`);
  }

  let blob: Blob;
  try {
    blob = await (await fetch(dataUrl)).blob();
  } catch (err) {
    throw new ImageCompressionError("decode_failed", `Failed to load image: ${String(err)}`);
  }

  let drawable: Awaited<ReturnType<typeof decodeToDrawable>>;
  try {
    drawable = await decodeToDrawable(dataUrl, blob);
  } catch (err) {
    throw new ImageCompressionError(
      "decode_failed",
      `Failed to decode image: ${String(err)}`,
    );
  }

  const srcW = Math.max(1, drawable.width);
  const srcH = Math.max(1, drawable.height);
  const maxSide = Math.max(srcW, srcH);
  const baseScale = Math.min(1, opts.maxEdge / maxSide);

  const qualities = [0.85, 0.75, 0.65, 0.55];
  const scaleStep = 0.85;
  const maxOuterIters = 8;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ImageCompressionError("encode_failed", "Canvas 2D context unavailable");
    }
    ctx.imageSmoothingEnabled = true;
    const smoothCtx = ctx as CanvasRenderingContext2D & {
      imageSmoothingQuality?: "low" | "medium" | "high";
    };
    if (smoothCtx.imageSmoothingQuality) {
      smoothCtx.imageSmoothingQuality = "high";
    }

    // Outer loop reduces dimensions; inner loop reduces quality.
    let scale = baseScale;
    for (let i = 0; i < maxOuterIters; i++) {
      const targetW = Math.max(1, Math.round(srcW * scale));
      const targetH = Math.max(1, Math.round(srcH * scale));
      canvas.width = targetW;
      canvas.height = targetH;

      // JPEG doesn't support alpha; fill a white background to avoid black/garbage.
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, targetW, targetH);
      drawable.draw(ctx, targetW, targetH);

      for (const q of qualities) {
        let outBlob: Blob;
        try {
          outBlob = await canvasToBlob(canvas, opts.outputMimeType, q);
        } catch (err) {
          throw new ImageCompressionError(
            "encode_failed",
            `Failed to encode JPEG: ${String(err)}`,
          );
        }
        if (outBlob.size > 0 && outBlob.size <= opts.maxBytes) {
          const outDataUrl = await blobToDataUrl(outBlob);
          return {
            dataUrl: outDataUrl,
            mimeType: opts.outputMimeType,
            sizeBytes: outBlob.size,
            changed: true,
          };
        }
      }

      scale *= scaleStep;
    }

    throw new ImageCompressionError(
      "too_large",
      "Image still exceeds size limit after compression",
    );
  } finally {
    // Ensure we always release ImageBitmap resources.
    drawable.cleanup();
  }
}
