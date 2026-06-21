import { describe, expect, it } from "vitest";

import { extractApiErrorMessage } from "./extract-api-error";

describe("extractApiErrorMessage", () => {
  it("returns plain string payloads", () => {
    expect(extractApiErrorMessage("Bad request")).toBe("Bad request");
  });

  it("handles legacy DRF detail field", () => {
    expect(extractApiErrorMessage({ detail: "Not found." })).toBe("Not found.");
  });

  it("handles structured backend envelope with validation details", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "validation_error",
          status: 400,
          details: { username: ["This field is required."] },
        },
      })
    ).toBe("username: This field is required.");
  });

  it("handles structured backend envelope with message", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "internal_error",
          status: 500,
          message: "An unexpected error occurred.",
        },
      })
    ).toBe("An unexpected error occurred.");
  });

  it("handles nested detail inside envelope details", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "client_error",
          status: 403,
          details: { detail: "You do not have permission." },
        },
      })
    ).toBe("You do not have permission.");
  });
});
