import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useCardLayout } from "./use-card-layout";

const KEY = "monitoring.cardLayout";

describe("useCardLayout", () => {
  afterEach(() => window.localStorage.clear());

  it("defaults to medium cards", () => {
    const { result } = renderHook(() => useCardLayout());
    expect(result.current[0]).toBe("medium");
  });

  it("restores the size picked last time", () => {
    window.localStorage.setItem(KEY, "small");
    const { result } = renderHook(() => useCardLayout());
    expect(result.current[0]).toBe("small");
  });

  it("ignores a stored value that is not a size", () => {
    window.localStorage.setItem(KEY, '{"bogus":true}');
    const { result } = renderHook(() => useCardLayout());
    expect(result.current[0]).toBe("medium");
  });

  it("remembers a new choice", () => {
    const { result } = renderHook(() => useCardLayout());
    act(() => result.current[1]("large"));
    expect(result.current[0]).toBe("large");
    expect(window.localStorage.getItem(KEY)).toBe("large");
  });
});
