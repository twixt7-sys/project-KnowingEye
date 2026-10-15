import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCanPreviewExam } from "./use-can-preview-exam";

const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null, granted: new Set<string>() }));
vi.mock("@/core/providers/auth-provider", () => ({
  useAuth: () => ({ user: auth.user, can: (action: string) => auth.granted.has(action) }),
}));

function canPreview(createdBy?: number | null) {
  return renderHook(() => useCanPreviewExam()).result.current(createdBy);
}

beforeEach(() => {
  auth.user = { id: 7 };
  auth.granted = new Set();
});

describe("useCanPreviewExam", () => {
  it("lets a reviewer preview any exam", () => {
    auth.granted = new Set(["exams.approve"]);
    expect(canPreview(99)).toBe(true);
    expect(canPreview(undefined)).toBe(true);
  });

  it("lets an editor preview only the exams they created", () => {
    auth.granted = new Set(["exams.update"]);
    expect(canPreview(7)).toBe(true);
    expect(canPreview(99)).toBe(false);
  });

  it("does not match an exam with an unknown creator", () => {
    auth.granted = new Set(["exams.update"]);
    expect(canPreview(undefined)).toBe(false);
    expect(canPreview(null)).toBe(false);
  });

  it("denies a user with neither permission", () => {
    expect(canPreview(7)).toBe(false);
  });
});
