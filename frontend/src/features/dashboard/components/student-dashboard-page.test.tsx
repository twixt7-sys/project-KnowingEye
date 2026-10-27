import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Exam } from "@/core/config/api";
import { fetchCompletedSessions, fetchMyExams } from "@/features/dashboard/api/dashboard-api";
import { StudentDashboardPage } from "@/features/dashboard/components/student-dashboard-page";
import { STUDENT_EXAMS_POLL_MS } from "@/features/dashboard/queries/queries";

vi.mock("@/features/dashboard/api/dashboard-api", () => ({
  fetchCompletedSessions: vi.fn(),
  fetchMyExams: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchCategories: vi.fn(),
}));

vi.mock("@/core/providers/auth-provider", () => ({
  useAuth: () => ({ user: { username: "examinee" } }),
}));

const fetchExams = vi.mocked(fetchMyExams);

function exam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: 7,
    title: "Freshly Published Exam",
    description: "",
    duration_minutes: 30,
    total_questions: 1,
    passing_score: 50,
    status: "active",
    created_at: "2026-10-26T00:00:00Z",
    monitoring_enabled: false,
    is_open: true,
    attempts_remaining: 1,
    ...overrides,
  };
}

function renderPage() {
  // Focus refetching is off app-wide (see QueryProvider), so the exam list has to opt back in.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StudentDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.mocked(fetchCompletedSessions).mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  focusManager.setFocused(undefined);
});

describe("StudentDashboardPage exam list", () => {
  it("picks up an exam published (or opened) after the page loaded, without a reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchExams.mockResolvedValueOnce([]).mockResolvedValue([exam()]);

    renderPage();
    expect(await screen.findByText(/Nothing is due right now/)).toBeTruthy();
    expect(screen.queryByText("Freshly Published Exam")).toBeNull();

    await vi.advanceTimersByTimeAsync(STUDENT_EXAMS_POLL_MS);

    expect(await screen.findByText("Freshly Published Exam")).toBeTruthy();
    expect(fetchExams).toHaveBeenCalledTimes(2);
  });

  it("re-checks when the examinee comes back to the tab", async () => {
    fetchExams.mockResolvedValueOnce([]).mockResolvedValue([exam()]);

    renderPage();
    expect(await screen.findByText(/Nothing is due right now/)).toBeTruthy();

    focusManager.setFocused(false);
    focusManager.setFocused(true);

    expect(await screen.findByText("Freshly Published Exam")).toBeTruthy();
  });

  it("drops an exam once a poll says it closed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchExams.mockResolvedValueOnce([exam()]).mockResolvedValue([exam({ is_open: false })]);

    renderPage();
    expect(await screen.findByText("Freshly Published Exam")).toBeTruthy();

    await vi.advanceTimersByTimeAsync(STUDENT_EXAMS_POLL_MS);

    await waitFor(() => expect(screen.queryByText("Freshly Published Exam")).toBeNull());
  });

  it("never lists closed exams or exams with no attempts left", async () => {
    fetchExams.mockResolvedValue([
      exam({ id: 1, title: "Closed Exam", is_open: false }),
      exam({ id: 2, title: "Used Up Exam", attempts_remaining: 0 }),
      exam({ id: 3, title: "Open Exam" }),
    ]);

    renderPage();

    expect(await screen.findByText("Open Exam")).toBeTruthy();
    expect(screen.queryByText("Closed Exam")).toBeNull();
    expect(screen.queryByText("Used Up Exam")).toBeNull();
  });
});
