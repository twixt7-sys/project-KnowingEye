import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExamPreview } from "@/core/config/api";
import { examBuilderKeys } from "@/features/exams/queries/keys";
import { useExamPreview } from "./use-exam-preview";

const api = vi.hoisted(() => ({ fetchExamPreview: vi.fn() }));
vi.mock("@/features/exams/api/exam-api", () => api);

afterEach(() => {
  cleanup(); // vitest `globals` is off, so RTL does not auto-clean
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function question(id: number, order: number) {
  return {
    id,
    exam: 5,
    question_text: `Q${id}`,
    question_type: "short_answer" as const,
    options: [],
    points: 1,
    order,
  };
}

const preview = {
  id: 5,
  title: "Midterm",
  duration_minutes: 1,
  is_preview: true,
  questions: [question(11, 1), question(12, 2), question(13, 3)],
  sections: [],
} as unknown as ExamPreview;

beforeEach(() => {
  api.fetchExamPreview.mockReset().mockResolvedValue(preview);
});

/** Mounts the hook at the last entry; earlier entries are the history behind it. */
function setup(...entries: string[]) {
  const client = new QueryClient();
  const here = { path: "" };
  function LocationProbe() {
    const { pathname } = useLocation();
    here.path = pathname;
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <LocationProbe />
        <Routes>
          <Route path="/examiner/exams/:examId/preview" element={children} />
          <Route path="/examiner/exams/:examId/edit" element={null} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, here, ...renderHook(() => useExamPreview(), { wrapper }) };
}

describe("useExamPreview", () => {
  it("opens on the instructions page", async () => {
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    expect(result.current.phase).toBe("instructions");
    expect(result.current.currentQuestion).toBe(0);
    expect(api.fetchExamPreview).toHaveBeenCalledWith(5);
  });

  it("starts the runner on demand", async () => {
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    act(() => result.current.start());
    expect(result.current.phase).toBe("running");
  });

  it("deep-links straight to a question, skipping the instructions", async () => {
    const { result } = setup("/examiner/exams/5/preview?q=12");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    expect(result.current.phase).toBe("running");
    expect(result.current.currentQuestion).toBe(1);
    expect(result.current.requestedQuestionMissing).toBe(false);
  });

  it("falls back to the first question when the linked one wasn't drawn", async () => {
    const { result } = setup("/examiner/exams/5/preview?q=999");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    expect(result.current.currentQuestion).toBe(0);
    expect(result.current.requestedQuestionMissing).toBe(true);
  });

  it("keeps answers and flags in memory only", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());

    act(() => result.current.setAnswer(11, "hello"));
    act(() => result.current.toggleFlag(12));

    expect(result.current.answeredCount).toBe(1);
    expect(result.current.flaggedCount).toBe(1);
    expect(result.current.progress).toBeCloseTo(100 / 3);
    expect(storageWrite).not.toHaveBeenCalled();
    expect(api.fetchExamPreview).toHaveBeenCalledOnce();
  });

  it("counts the clock down to zero and then just stops", async () => {
    // Installed before the hook mounts so its interval runs on the fake clock;
    // shouldAdvanceTime keeps waitFor's polling working.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = setup("/examiner/exams/5/preview?q=11");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    expect(result.current.timeRemaining).toBe(60);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.timeRemaining).toBeLessThanOrEqual(55);

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current.timeRemaining).toBe(0);
    expect(api.fetchExamPreview).toHaveBeenCalledOnce();
  });

  it("doesn't start the clock until the runner opens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.timeRemaining).toBeGreaterThanOrEqual(58));
  });

  it("is never refetched, and so never reshuffled, once loaded", async () => {
    const { result, client } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());

    // Everything that would refetch an ordinary query: a builder invalidation,
    // the window regaining focus, the network coming back.
    await act(async () => {
      await client.invalidateQueries({ queryKey: examBuilderKeys.detail(5) });
      focusManager.setFocused(true);
      onlineManager.setOnline(true);
    });
    expect(api.fetchExamPreview).toHaveBeenCalledOnce();
  });

  it("leaves via the previous page when it was reached from the builder", async () => {
    const { result, here } = setup("/examiner/exams/5/edit?tab=questions", "/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    act(() => result.current.exit());
    expect(here.path).toBe("/examiner/exams/5/edit");
  });

  it("leaves for the builder when the preview was opened directly", async () => {
    const { result, here } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    act(() => result.current.exit());
    expect(here.path).toBe("/examiner/exams/5/edit");
  });

  it("reports an empty exam", async () => {
    api.fetchExamPreview.mockResolvedValue({ ...preview, questions: [] });
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.exam).toBeDefined());
    expect(result.current.isEmpty).toBe(true);
  });

  it("surfaces a load failure", async () => {
    api.fetchExamPreview.mockRejectedValue(new Error("boom"));
    const { result } = setup("/examiner/exams/5/preview");
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.exam).toBeUndefined();
  });
});
