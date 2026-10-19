import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Exam } from "@/core/config/api";
import { ExamCatalog, type ExamCatalogView } from "@/features/dashboard/components/exam-catalog";
import { archiveExam, unarchiveExam } from "@/features/exams/api/exam-api";

vi.mock("@/core/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 }, can: () => true }),
}));
vi.mock("@/shared/components/common/confirm-dialog", () => ({
  useConfirm: () => async () => true,
}));
vi.mock("@/features/dashboard/api/dashboard-api", () => ({
  fetchCategories: vi.fn(async () => []),
  fetchDepartments: vi.fn(async () => []),
  fetchMyExams: vi.fn(async () => []),
  fetchCompletedSessions: vi.fn(),
}));
vi.mock("@/features/exams/api/exam-api", () => ({
  archiveExam: vi.fn(async () => undefined),
  unarchiveExam: vi.fn(async () => undefined),
  publishExam: vi.fn(async () => undefined),
  unpublishExam: vi.fn(async () => undefined),
  deleteExam: vi.fn(async () => undefined),
}));

function exam(id: number, over: Partial<Exam> = {}): Exam {
  return {
    id,
    title: `Exam ${id}`,
    exam_code: `ENT-2026-${id}`,
    status: "draft",
    total_questions: 5,
    duration_minutes: 30,
    created_at: `2026-09-0${id}T00:00:00Z`,
    created_by: 1,
    category: null,
    ...over,
  } as Exam;
}

type Props = Partial<React.ComponentProps<typeof ExamCatalog>>;

function renderCatalog(view: ExamCatalogView, props: Props = {}) {
  const onRetry = vi.fn();
  const onCreate = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (ui: ReactNode) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
  render(
    wrap(
      <ExamCatalog
        view={view}
        exams={[]}
        loading={false}
        error={null}
        onRetry={onRetry}
        onCreate={onCreate}
        {...props}
      />,
    ),
  );
  return { onRetry, onCreate, client };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

describe("ExamCatalog loading and error states", () => {
  it("shows a spinner, not 'No exams available', while the exams are loading", () => {
    renderCatalog("active", { loading: true });

    expect(screen.getByText("Loading exams…")).toBeInTheDocument();
    expect(screen.queryByText("No exams available")).not.toBeInTheDocument();
  });

  it("says 'No exams available' only once loading has finished with nothing returned", () => {
    renderCatalog("active");

    expect(screen.getByRole("heading", { name: "No exams available" })).toBeInTheDocument();
  });

  it("offers to create an exam from the empty state", () => {
    const { onCreate } = renderCatalog("active");

    fireEvent.click(screen.getByRole("button", { name: /create exam/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows an error with a retry, never 'No exams available', when the load failed", () => {
    const { onRetry } = renderCatalog("active", { error: "Could not load exams" });

    expect(screen.getByRole("heading", { name: "Couldn't load exams" })).toBeInTheDocument();
    expect(screen.queryByText("No exams available")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the exams on screen and warns when a background refresh fails", () => {
    renderCatalog("active", { exams: [exam(1)], error: "Network down" });

    expect(screen.getByText("Exam 1")).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });
});

describe("ExamCatalog active vs archived pages", () => {
  const exams = [
    exam(1, { status: "draft" }),
    exam(2, { status: "active" }),
    exam(3, { status: "archived" }),
  ];

  it("keeps archived exams off the active page and links to the archive with a count", () => {
    renderCatalog("active", { exams });

    expect(screen.getByText("Exam 1")).toBeInTheDocument();
    expect(screen.getByText("Exam 2")).toBeInTheDocument();
    expect(screen.queryByText("Exam 3")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archived exams (1)" })).toHaveAttribute(
      "href",
      "/examiner/archived",
    );
  });

  it("labels a published exam as published, not 'active'", () => {
    renderCatalog("active", { exams: [exam(2, { status: "active" })] });

    const card = within(screen.getByRole("article"));
    expect(card.getByText("published")).toBeInTheDocument();
    expect(card.queryByText("active")).not.toBeInTheDocument();
  });

  it("lists only archived exams on the archive page", () => {
    renderCatalog("archived", { exams });

    expect(screen.getByText("Exam 3")).toBeInTheDocument();
    expect(screen.queryByText("Exam 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Exam 2")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Active exams" })).toHaveAttribute(
      "href",
      "/examiner",
    );
  });

  it("shows an archive-specific empty state when nothing is archived", () => {
    renderCatalog("archived", { exams: [exam(1)] });

    expect(screen.getByRole("heading", { name: "No archived exams" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create exam/i })).not.toBeInTheDocument();
  });

  it("archives an exam and refreshes the dashboard lists", async () => {
    const { client } = renderCatalog("active", { exams: [exam(1)] });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(archiveExam).toHaveBeenCalledWith(1));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("unarchives an exam from the archive page", async () => {
    renderCatalog("archived", { exams: [exam(3, { status: "archived" })] });

    fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => expect(unarchiveExam).toHaveBeenCalledWith(3));
  });
});

describe("ExamCatalog filters", () => {
  it("tells the user nothing matches, and clears the search", async () => {
    renderCatalog("active", { exams: [exam(1)] });

    fireEvent.change(screen.getByPlaceholderText(/search by title or code/i), {
      target: { value: "zzz" },
    });

    expect(
      await screen.findByRole("heading", { name: "No exams match your filters" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Exam 1")).toBeInTheDocument();
  });
});
