// Mirrors backend/features/exams/attachment_utils.py so bad files are rejected
// before the upload round-trip, with a message the creator can act on.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const PICTURE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
export const DOCUMENT_ACCEPT = "application/pdf,audio/mpeg,audio/wav";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

function resolveMime(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "";
}

export function isPictureFile(file: File): boolean {
  return resolveMime(file).startsWith("image/");
}

/** Returns a human-readable problem, or null when the file can be uploaded. */
export function validateAttachment(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `"${file.name}" is larger than ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`;
  }
  if (!ALLOWED_MIME_TYPES.has(resolveMime(file))) {
    return `"${file.name}" isn't a supported type. Use JPEG, PNG, GIF, WebP, PDF, MP3 or WAV.`;
  }
  return null;
}
