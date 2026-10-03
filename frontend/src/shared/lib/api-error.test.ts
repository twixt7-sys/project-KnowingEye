import { describe, expect, it } from "vitest";

import { ApiError, isProctorHalt, isSessionOver } from "./api-error";

const refusal = (code?: string) =>
  new ApiError(400, code ? { error: "No.", code } : { error: "No." });

describe("ApiError.code", () => {
  it("exposes the machine-readable reason the server sent", () => {
    expect(refusal("session_terminated").code).toBe("session_terminated");
  });

  it("is undefined when there is none, whatever shape the body has", () => {
    expect(refusal().code).toBeUndefined();
    expect(new ApiError(500, "<html>Server error</html>").code).toBeUndefined();
    expect(new ApiError(502, null).code).toBeUndefined();
    expect(new ApiError(400, { code: 7 }).code).toBeUndefined();
  });
});

describe("isProctorHalt", () => {
  it("is true for a pause or termination", () => {
    expect(isProctorHalt(refusal("session_paused"))).toBe(true);
    expect(isProctorHalt(refusal("session_terminated"))).toBe(true);
  });

  it("is false for anything else, so ordinary failures still surface", () => {
    expect(isProctorHalt(refusal("session_expired"))).toBe(false);
    expect(isProctorHalt(refusal())).toBe(false);
    expect(isProctorHalt(new Error("session_paused"))).toBe(false);
    expect(isProctorHalt(undefined)).toBe(false);
  });
});

describe("isSessionOver", () => {
  it("is true when the attempt has ended for good", () => {
    expect(isSessionOver(refusal("session_terminated"))).toBe(true);
    expect(isSessionOver(refusal("session_expired"))).toBe(true);
    expect(isSessionOver(refusal("session_submitted"))).toBe(true);
  });

  it("is false for a pause, which the examinee comes back from", () => {
    expect(isSessionOver(refusal("session_paused"))).toBe(false);
    expect(isSessionOver(refusal())).toBe(false);
  });
});
