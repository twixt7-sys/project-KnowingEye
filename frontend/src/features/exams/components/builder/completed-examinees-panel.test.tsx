import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCompletedExaminees } from "@/features/exams/api/exam-api";
import { CompletedExamineesPanel } from "@/features/exams/components/builder/completed-examinees-panel";

vi.mock("@/features/exams/api/exam-api", () => ({
  fetchCompletedExaminees: vi.fn(),
  fetchExamAssignments: vi.fn(),
  fetchExamById: vi.fn(),
  fetchExamPreview: vi.fn(),
  fetchExamReadiness: vi.fn(),
  fetchExamSections: vi.fn(),
  fetchQuestions: vi.fn(),
}));

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const row = (over = {}) => ({
  user_id: 1,
  username: "ana",
  email: "ana@school.test",
  name: "Ana Reyes",
  attempts_completed: 2,
  last_completed_at: "2026-09-01T10:00:00Z",
  last_score: 82,
  passed: true,
  on_roster: true,
  roster_status: "eligible",
  ...over,
});

function renderPanel(enforced: boolean, results: ReturnType<typeof row>[]) {
  vi.mocked(fetchCompletedExaminees).mockResolvedValue({
    exclusion_enforced: enforced,
    count: results.length,
    results,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CompletedExamineesPanel examId={7} enforced={enforced} />
    </QueryClientProvider>,
  );
}

describe("CompletedExamineesPanel", () => {
  it("lists who already completed the exam, with attempts, score and roster state", async () => {
    renderPanel(true, [
      row(),
      row({ user_id: 2, name: "Ben Cruz", email: "ben@school.test", attempts_completed: 1, passed: false, last_score: 30, on_roster: false }),
    ]);

    expect(await screen.findByText("Ana Reyes")).toBeTruthy();
    expect(screen.getByText("Already completed (2)")).toBeTruthy();
    expect(screen.getByText("2 attempts")).toBeTruthy();
    expect(screen.getByText("1 attempt")).toBeTruthy();
    expect(screen.getByText("On roster")).toBeTruthy();
    expect(screen.getByText("Not on roster")).toBeTruthy();
    expect(fetchCompletedExaminees).toHaveBeenCalledWith(7);
  });

  it("says the exclusion is enforced when the exam setting is on", async () => {
    renderPanel(true, [row()]);
    expect((await screen.findByTestId("exclusion-status")).textContent).toBe("Exclusion enforced");
    expect(screen.getByText(/cannot start it again/)).toBeTruthy();
  });

  it("points at the Settings toggle when the exclusion is off", async () => {
    renderPanel(false, [row()]);
    expect((await screen.findByTestId("exclusion-status")).textContent).toBe("Exclusion off");
    expect(screen.getByText(/Turn on "Exclude examinees/)).toBeTruthy();
  });

  it("shows an empty state when nobody has completed it", async () => {
    renderPanel(false, []);
    expect(await screen.findByText("Nobody has completed this exam yet.")).toBeTruthy();
  });

  it("shows the error when the list cannot be loaded", async () => {
    vi.mocked(fetchCompletedExaminees).mockRejectedValue(new Error("boom"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CompletedExamineesPanel examId={7} enforced={false} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/boom/)).toBeTruthy();
  });
});
