import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Exam, SessionReportRow } from "@/core/config/api";
import { fetchCompletedSessions } from "@/features/dashboard/api/dashboard-api";
import { StudentAvailableExams } from "@/features/dashboard/components/student-available-exams";
import { StudentCompletedExams } from "@/features/dashboard/components/student-completed-exams";

vi.mock("@/features/dashboard/api/dashboard-api", () => ({
  fetchCompletedSessions: vi.fn(),
  fetchMyExams: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchCategories: vi.fn(),
}));

const fetchSessions = vi.mocked(fetchCompletedSessions);

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function session(n: number, overrides: Partial<SessionReportRow> = {}): SessionReportRow {
  return {
    id: `session-${n}`,
    exam_id: n,
    exam_title: `Exam ${n}`,
    user: "student",
    user_full_name: "",
    status: "completed",
    started_at: "2026-09-01T00:00:00Z",
    submitted_at: "2026-09-01T01:00:00Z",
    percentage_score: 80,
    passed: true,
    alert_count: 0,
    unresolved_alert_count: 0,
    behavior_event_count: 0,
    ...overrides,
  };
}

function page(count: number, results: SessionReportRow[]) {
  return { count, next: null, previous: null, results };
}

function exam(n: number): Exam {
  return {
    id: n,
    title: `Open Exam ${n}`,
    description: "",
    duration_minutes: 30,
    total_questions: 5,
    passing_score: 50,
    status: "active",
    created_at: `2026-01-${String(n).padStart(2, "0")}T00:00:00Z`,
    monitoring_enabled: n % 2 === 0,
  };
}

const noop = () => {};

// Vitest runs without globals here, so Testing Library will not unmount between tests on its own.
afterEach(cleanup);

describe("StudentCompletedExams", () => {
  beforeEach(() => {
    fetchSessions.mockReset();
  });

  it("shows a spinner until the first page arrives, then the rows and the count", async () => {
    const first = deferred<ReturnType<typeof page>>();
    fetchSessions.mockReturnValue(first.promise);
    renderWithProviders(<StudentCompletedExams />);

    expect(screen.getByText("Loading results…")).toBeInTheDocument();

    first.resolve(page(2, [session(1), session(2)]));
    expect(await screen.findByText("Exam 1")).toBeInTheDocument();
    expect(screen.queryByText("Loading results…")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument();
  });

  it("sends sort, result filter, search and page to the server", async () => {
    fetchSessions.mockResolvedValue(page(25, [session(1)]));
    renderWithProviders(<StudentCompletedExams />);
    await screen.findByText("Exam 1");

    expect(fetchSessions).toHaveBeenLastCalledWith({
      ordering: "-started_at",
      page: 1,
      page_size: 10,
    });

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "-percentage_score" } });
    await waitFor(() =>
      expect(fetchSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ ordering: "-percentage_score", page: 1 }),
      ),
    );

    // Pagination is disabled while a request is in flight, so let the new sort settle first.
    await screen.findByText("Showing 1–10 of 25");
    fireEvent.click(screen.getByRole("link", { name: "2" }));
    await waitFor(() =>
      expect(fetchSessions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );

    // Changing a filter returns to page 1.
    fireEvent.click(screen.getByRole("button", { name: "Not passed" }));
    await waitFor(() =>
      expect(fetchSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ passed: false, page: 1 }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText("Search by exam title…"), {
      target: { value: "  alg " },
    });
    await waitFor(() =>
      expect(fetchSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "alg", passed: false, page: 1 }),
      ),
    );
  });

  it("keeps the current rows, dimmed, while the next page loads", async () => {
    fetchSessions.mockResolvedValueOnce(page(25, [session(1)]));
    renderWithProviders(<StudentCompletedExams />);
    await screen.findByText("Exam 1");

    const next = deferred<ReturnType<typeof page>>();
    fetchSessions.mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(screen.getByText("Loading…")).toBeInTheDocument());
    expect(screen.getByText("Exam 1")).toBeInTheDocument();
    expect(screen.getByText("Exam 1").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");

    next.resolve(page(25, [session(11)]));
    expect(await screen.findByText("Exam 11")).toBeInTheDocument();
    expect(screen.queryByText("Exam 1")).not.toBeInTheDocument();
  });

  it("offers to clear the filters when nothing matches", async () => {
    fetchSessions.mockResolvedValueOnce(page(1, [session(1)]));
    renderWithProviders(<StudentCompletedExams />);
    await screen.findByText("Exam 1");

    fetchSessions.mockResolvedValue(page(0, []));
    fireEvent.change(screen.getByPlaceholderText("Search by exam title…"), {
      target: { value: "zzz" },
    });
    expect(await screen.findByRole("heading", { name: "No results match" })).toBeInTheDocument();

    fetchSessions.mockResolvedValue(page(1, [session(1)]));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Exam 1")).toBeInTheDocument();
    expect(fetchSessions).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ search: expect.anything() }),
    );
  });

  it("shows the plain empty state when there are no attempts at all", async () => {
    fetchSessions.mockResolvedValue(page(0, []));
    renderWithProviders(<StudentCompletedExams />);
    expect(
      await screen.findByRole("heading", { name: "No completed exams yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});

describe("StudentAvailableExams", () => {
  const exams = Array.from({ length: 8 }, (_, i) => exam(i + 1));

  it("shows a spinner and no cards while loading", () => {
    renderWithProviders(
      <StudentAvailableExams exams={[]} loading fetching error={null} onStart={noop} />,
    );
    expect(screen.getByText("Loading exams…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start exam/i })).not.toBeInTheDocument();
  });

  it("pages, searches and filters client-side", async () => {
    renderWithProviders(
      <StudentAvailableExams
        exams={exams}
        loading={false}
        fetching={false}
        error={null}
        onStart={noop}
      />,
    );

    expect(screen.getAllByRole("button", { name: /start exam/i })).toHaveLength(6);
    expect(screen.getByText("Showing 1–6 of 8")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "2" }));
    expect(screen.getAllByRole("button", { name: /start exam/i })).toHaveLength(2);
    expect(screen.getByText("Showing 7–8 of 8")).toBeInTheDocument();

    // Only the even-numbered exams are proctored; filtering returns to page 1.
    fireEvent.click(screen.getByRole("button", { name: "Proctored" }));
    expect(screen.getByText("Showing 1–4 of 4")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by title, code, or author…"), {
      target: { value: "exam 8" },
    });
    await waitFor(() => expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Open Exam 8" })).toBeInTheDocument();
  });

  it("explains an empty result and clears the filters", async () => {
    renderWithProviders(
      <StudentAvailableExams
        exams={exams}
        loading={false}
        fetching={false}
        error={null}
        onStart={noop}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search by title, code, or author…"), {
      target: { value: "zzz" },
    });
    expect(await screen.findByRole("heading", { name: "No exams match" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Showing 1–6 of 8")).toBeInTheDocument();
  });

  it("starts the chosen exam", () => {
    const onStart = vi.fn();
    renderWithProviders(
      <StudentAvailableExams
        exams={exams}
        loading={false}
        fetching={false}
        error={null}
        onStart={onStart}
      />,
    );
    const card = screen.getByRole("heading", { name: "Open Exam 8" }).closest("article");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: /start exam/i }));
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ id: "8", title: "Open Exam 8" }),
    );
  });
});
