import { describe, expect, it } from "vitest";

import { extractApiErrorMessage } from "./extract-api-error";

describe("extractApiErrorMessage", () => {
  it("returns plain string payloads", () => {
    expect(extractApiErrorMessage("Bad request")).toBe("Bad request.");
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
    ).toBe("Username: This field is required.");
  });

  it("handles multiple field errors with friendly labels", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "validation_error",
          status: 400,
          details: {
            username: ["This field is required."],
            password: ["This password is too short."],
          },
        },
      })
    ).toBe("Username: This field is required. Password: This password is too short.");
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

  it("omits non_field_errors label", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "validation_error",
          status: 400,
          details: {
            non_field_errors: ["Unable to log in with provided credentials."],
          },
        },
      })
    ).toBe("Unable to log in with provided credentials.");
  });

  it("formats nested objects without JSON", () => {
    expect(
      extractApiErrorMessage({
        success: false,
        error: {
          code: "validation_error",
          status: 400,
          details: {
            responses: [{ question_id: ["This field is required."] }],
          },
        },
      })
    ).toBe("Question: This field is required.");
  });

  it("handles flat DRF validation maps", () => {
    expect(
      extractApiErrorMessage({
        email: ["Enter a valid email address."],
      })
    ).toBe("Email: Enter a valid email address.");
  });

  it("never returns raw JSON", () => {
    const message = extractApiErrorMessage({
      success: false,
      error: { code: "weird", status: 400, details: null },
    });
    expect(message).not.toMatch(/[{}\[\]]/);
    expect(message).toBe("Something went wrong. Please try again.");
  });

  it("ignores HTML error pages", () => {
    expect(extractApiErrorMessage("<!DOCTYPE html><html></html>")).toBe(
      "Something went wrong. Please try again."
    );
  });
});
