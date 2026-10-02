/**
 * Client-side image compression for uploads.
 *
 * Downscales and re-encodes images in the browser before they are sent, so
 * phone-camera photos (often 3-8 MB) travel as a few hundred KB. The backend
 * re-compresses independently; this only saves bandwidth and upload time.
 *
 * Fails open: anything that cannot be decoded, animated/vector formats, and
 * re-encodes that are not actually smaller all return the original file.
 */

export interface CompressImageOptions {
  /** Longest edge, in pixels, after downscaling. */
  maxDimension: number;
  /** Encoder quality, 0-1. */
  quality?: number;
}

export const AVATAR_COMPRESSION: CompressImageOptions = { maxDimension: 512, quality: 0.85 };
export const OPTION_IMAGE_COMPRESSION: CompressImageOptions = { maxDimension: 800, quality: 0.82 };
export const ATTACHMENT_IMAGE_COMPRESSION: CompressImageOptions = { maxDimension: 1600, quality: 0.82 };

/** Files at or under this size with an in-bounds resolution are left alone. */
const SKIP_BELOW_BYTES = 60 * 1024;
/** A re-encode must save at least this fraction to be used. */
const MIN_SAVINGS = 0.1;
/** GIF may be animated and SVG is already vector - neither survives a canvas round-trip. */
const PASSTHROUGH_TYPES = new Set(["image/gif", "image/svg+xml"]);

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function replaceExtension(name: string, extension: string) {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name || "image"}.${extension}`;
}

export async function compressImage(file: File, options: CompressImageOptions): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_TYPES.has(file.type)) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= options.maxDimension && file.size <= SKIP_BELOW_BYTES) return file;

    const scale = Math.min(1, options.maxDimension / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const quality = options.quality ?? 0.82;
    let blob = await canvasToBlob(canvas, "image/webp", quality);
    // Browsers that cannot encode WebP silently hand back PNG; use JPEG there.
    if (!blob || blob.type !== "image/webp") {
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const flatCtx = flat.getContext("2d");
      if (!flatCtx) return file;
      flatCtx.fillStyle = "#fff"; // JPEG has no alpha
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(canvas, 0, 0);
      blob = await canvasToBlob(flat, "image/jpeg", quality);
    }
    if (!blob || blob.size > file.size * (1 - MIN_SAVINGS)) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], replaceExtension(file.name, extension), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
