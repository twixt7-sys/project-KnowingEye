import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withProcessing } from "@/shared/lib/processing";

import { PROCESSING_OVERLAY_DELAY_MS, ProcessingOverlay } from "./processing-overlay";

function renderOverlay() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ProcessingOverlay />
    </QueryClientProvider>,
  );
  return client;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup(); // vitest `globals` is off, so RTL does not auto-clean
  vi.useRealTimers();
});

describe("ProcessingOverlay", () => {
  it("shows a spinner and message once work has run past the delay, then clears", async () => {
    renderOverlay();
    const work = deferred();

    let done!: Promise<void>;
    act(() => {
      done = withProcessing("Archiving exam…", () => work.promise);
    });

    expect(screen.queryByText("Archiving exam…")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(PROCESSING_OVERLAY_DELAY_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Archiving exam…");

    await act(async () => {
      work.resolve();
      await done;
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("never flashes for work that finishes before the delay", async () => {
    renderOverlay();

    await act(async () => {
      await withProcessing("Saving…", async () => undefined);
      vi.advanceTimersByTime(PROCESSING_OVERLAY_DELAY_MS * 2);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears when the work fails, so the page is never left locked", async () => {
    renderOverlay();
    const work = deferred();

    let done!: Promise<void>;
    act(() => {
      done = withProcessing("Deleting exam…", () => work.promise);
    });
    act(() => {
      vi.advanceTimersByTime(PROCESSING_OVERLAY_DELAY_MS);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      work.reject(new Error("server said no"));
      await expect(done).rejects.toThrow("server said no");
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the most recent label while several actions overlap", async () => {
    renderOverlay();
    const first = deferred();
    const second = deferred();

    let firstDone!: Promise<void>;
    let secondDone!: Promise<void>;
    act(() => {
      firstDone = withProcessing("Publishing exam…", () => first.promise);
      secondDone = withProcessing("Duplicating exam…", () => second.promise);
    });
    act(() => {
      vi.advanceTimersByTime(PROCESSING_OVERLAY_DELAY_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Duplicating exam…");

    await act(async () => {
      second.resolve();
      await secondDone;
    });
    expect(screen.getByRole("status")).toHaveTextContent("Publishing exam…");

    await act(async () => {
      first.resolve();
      await firstDone;
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
