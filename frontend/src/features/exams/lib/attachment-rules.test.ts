import { describe, expect, it } from "vitest";

import { MAX_ATTACHMENT_BYTES, isPictureFile, validateAttachment } from "./attachment-rules";

function fileOf(name: string, type: string, size = 10): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateAttachment", () => {
  it("accepts the picture types the backend allows", () => {
    for (const [name, type] of [
      ["a.jpg", "image/jpeg"],
      ["a.png", "image/png"],
      ["a.gif", "image/gif"],
      ["a.webp", "image/webp"],
    ]) {
      expect(validateAttachment(fileOf(name, type))).toBeNull();
    }
  });

  it("rejects pictures the backend would refuse", () => {
    expect(validateAttachment(fileOf("a.svg", "image/svg+xml"))).toMatch(/supported type/);
    expect(validateAttachment(fileOf("a.heic", "image/heic"))).toMatch(/supported type/);
  });

  it("rejects files over the size limit", () => {
    expect(validateAttachment(fileOf("big.png", "image/png", MAX_ATTACHMENT_BYTES + 1))).toMatch(
      /larger than 10 MB/
    );
  });

  it("falls back to the file extension when the browser gives no MIME type", () => {
    expect(validateAttachment(fileOf("scan.png", ""))).toBeNull();
    expect(validateAttachment(fileOf("notes.docx", ""))).toMatch(/supported type/);
  });
});

describe("isPictureFile", () => {
  it("separates pictures from documents", () => {
    expect(isPictureFile(fileOf("a.png", "image/png"))).toBe(true);
    expect(isPictureFile(fileOf("a.pdf", "application/pdf"))).toBe(false);
    expect(isPictureFile(fileOf("a.jpeg", ""))).toBe(true);
  });
});
