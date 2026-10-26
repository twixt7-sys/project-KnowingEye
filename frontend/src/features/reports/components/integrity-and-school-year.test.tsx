import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/features/reports/api/reports-api";
import { IntegrityReportSection } from "@/features/reports/components/integrity-report-section";
import { SchoolYearSection } from "@/features/reports/components/school-year-section";
import type {
  IntegrityReport,
  IntegritySessionsResponse,
  SchoolYearDetail,
  SchoolYearReport,
} from "@/shared/types/api";

const auth = vi.hoisted(() => ({ can: (_action: string) => true }));
vi.mock("@/core/providers/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("@tremor/react", () => ({ BarChart: () => null }));
vi.mock("@/features/reports/api/reports-api", () => ({
  fetchIntegrityReport: vi.fn(),
  fetchIntegritySessions: vi.fn(),
  fetchSchoolYearReport: vi.fn(),
  fetchSchoolYearDetail: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchExamAnalytics: vi.fn(),
  fetchReportSummary: vi.fn(),
  fetchSessionReport: vi.fn(),
  fetchSessionReports: vi.fn(),
  fetchTimeseries: vi.fn(),
  downloadIntegrityCsv: vi.fn(async () => undefined),
  downloadIntegrityPdf: vi.fn(async () => undefined),
}));

afterEach(cleanup);

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const breakdown = { alert_count: 0, unresolved_alerts: 0, alerts_by_type: {}, alerts_by_severity: {} };

const integrity: IntegrityReport = {
  totals: {
    sessions: 12,
    candidates: 10,
    flagged_sessions: 4,
    flagged_candidates: 3,
    terminated_sessions: 1,
    candidate_flag_rate: 30,
    alert_count: 6,
    unresolved_alerts: 2,
    alerts_by_type: { looking_away: 4, no_face: 2 },
    alerts_by_severity: { high: 3, low: 3 },
  },
  by_exam: [
    {
      exam_id: 5,
      exam_title: "Entrance Exam",
      department_id: 1,
      department_name: "Computing",
      department_abbreviation: "CS",
      sessions: 8,
      candidates: 6,
      flagged_sessions: 3,
      flagged_candidates: 2,
      candidate_flag_rate: 33.3,
      terminated_sessions: 1,
      ...breakdown,
      alert_count: 5,
      unresolved_alerts: 2,
      alerts_by_type: { looking_away: 3, no_face: 2 },
    },
    {
      exam_id: 6,
      exam_title: "Math Quiz",
      department_id: null,
      department_name: null,
      department_abbreviation: null,
      sessions: 4,
      candidates: 4,
      flagged_sessions: 1,
      flagged_candidates: 1,
      candidate_flag_rate: 25,
      terminated_sessions: 0,
      ...breakdown,
      alert_count: 1,
      alerts_by_type: { looking_away: 1 },
    },
  ],
  filters: { exam_id: null, department_id: null, school_year: null },
  school_year_start_month: 6,
  generated_at: "2026-10-19T00:00:00Z",
};

const flagged: IntegritySessionsResponse = {
  count: 1,
  truncated: false,
  results: [
    {
      session_id: "s-1",
      exam_id: 5,
      exam_title: "Entrance Exam",
      department_abbreviation: "CS",
      user_id: 9,
      username: "cheater",
      full_name: "Chet Eater",
      seat_label: "R2-S4",
      status: "completed",
      terminated: false,
      started_at: "2026-09-01T08:00:00Z",
      submitted_at: "2026-09-01T09:00:00Z",
      percentage_score: 91,
      ebi_average: 54,
      alert_count: 1,
      unresolved_alerts: 1,
      alerts: [
        {
          id: "a-1",
          alert_type: "looking_away",
          severity: "high",
          message: "Looked away for 40s",
          metric_pct: 40,
          resolved: false,
          created_at: "2026-09-01T08:30:00Z",
        },
      ],
    },
  ],
};

const years: SchoolYearReport = {
  start_month: 6,
  years: [2023, 2024, 2025].map((y, i) => ({
    school_year: `${y}-${y + 1}`,
    start_year: y,
    period_start: `${y}-06-01`,
    period_end: `${y + 1}-05-31`,
    exams: 2,
    sessions: 10,
    completed_sessions: 9,
    examinees: 8,
    pass_rate: 50 + i * 10,
    average_score: 65 + i * 5,
    average_ebi: 80,
    flagged_sessions: 2,
    flagged_candidates: 2,
    flagged_rate: 30 - i * 10,
  })),
};

const detail: SchoolYearDetail = {
  school_year: "2025-2026",
  start_year: 2025,
  by_exam: [
    {
      exam_id: 5,
      exam_title: "Entrance Exam",
      department_abbreviation: "CS",
      sessions: 5,
      completed_sessions: 5,
      examinees: 5,
      pass_rate: 80,
      average_score: 75,
      average_ebi: 88,
      flagged_sessions: 1,
      flagged_candidates: 1,
      flagged_rate: 20,
    },
  ],
  by_department: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.can = () => true;
  vi.mocked(api.fetchIntegrityReport).mockResolvedValue(integrity);
  vi.mocked(api.fetchIntegritySessions).mockResolvedValue(flagged);
  vi.mocked(api.fetchSchoolYearReport).mockResolvedValue(years);
  vi.mocked(api.fetchSchoolYearDetail).mockResolvedValue(detail);
  vi.mocked(api.fetchDepartments).mockResolvedValue([
    { id: 1, name: "Computing", abbreviation: "CS" },
  ] as never);
});

describe("IntegrityReportSection", () => {
  it("shows flagged candidates out of all candidates, once each", async () => {
    render(wrap(<IntegrityReportSection />));
    const tiles = await screen.findByTestId("integrity-tiles");
    expect(within(tiles).getByText("3 of 10")).toBeTruthy();
    expect(within(tiles).getByText("4 of 12")).toBeTruthy();
    expect(within(tiles).getByText("30% of candidates")).toBeTruthy();
  });

  it("lists exams with their flagged counts and top alert types", async () => {
    render(wrap(<IntegrityReportSection />));
    expect(await screen.findByText("Entrance Exam")).toBeTruthy();
    expect(screen.getByText("Math Quiz")).toBeTruthy();
    expect(screen.getByText("2 (33%)")).toBeTruthy();
    expect(screen.getByText("looking away 3, no face 2")).toBeTruthy();
  });

  it("drills down to the flagged sessions and their alerts for one exam", async () => {
    render(wrap(<IntegrityReportSection />));
    await screen.findByText("Entrance Exam");
    fireEvent.click(screen.getAllByText("View flagged")[0]);

    const panel = await screen.findByTestId("flagged-5");
    expect(within(panel).getByText(/Chet Eater/)).toBeTruthy();
    expect(within(panel).getByText("seat R2-S4")).toBeTruthy();
    expect(within(panel).getByText("Looked away for 40s")).toBeTruthy();
    expect(api.fetchIntegritySessions).toHaveBeenCalledWith({ exam: 5 });
    expect(within(panel).getByText("Open session").getAttribute("href")).toBe("/monitoring/s-1");
  });

  it("narrows the report by school year and exports with the same filters", async () => {
    render(wrap(<IntegrityReportSection />));
    await screen.findByText("Entrance Exam");
    fireEvent.change(screen.getByLabelText("School year"), { target: { value: "2024" } });
    await waitFor(() =>
      expect(api.fetchIntegrityReport).toHaveBeenLastCalledWith({ school_year: 2024 }),
    );

    fireEvent.click(screen.getByText("Export CSV"));
    await waitFor(() => expect(api.downloadIntegrityCsv).toHaveBeenCalledWith({ school_year: 2024 }));
    fireEvent.click(screen.getByText("Export PDF"));
    await waitFor(() => expect(api.downloadIntegrityPdf).toHaveBeenCalledWith({ school_year: 2024 }));
  });

  it("hides the export buttons without the reports.export permission", async () => {
    auth.can = (action) => action !== "reports.export";
    render(wrap(<IntegrityReportSection />));
    await screen.findByText("Entrance Exam");
    expect(screen.queryByText("Export CSV")).toBeNull();
    expect(screen.queryByText("Export PDF")).toBeNull();
  });

  it("shows an export failure", async () => {
    vi.mocked(api.downloadIntegrityPdf).mockRejectedValueOnce(new Error("no pdf"));
    render(wrap(<IntegrityReportSection />));
    await screen.findByText("Entrance Exam");
    fireEvent.click(screen.getByText("Export PDF"));
    expect(await screen.findByText(/no pdf/)).toBeTruthy();
  });
});

describe("SchoolYearSection", () => {
  it("lists school years newest first with their metrics", async () => {
    render(wrap(<SchoolYearSection />));
    const rows = await screen.findAllByText(/^SY 20\d\d-20\d\d$/);
    // Table rows come first; the first one listed is the newest year.
    expect(rows[0].textContent).toBe("SY 2025-2026");
    expect(screen.getByText(/A school year starts in June/)).toBeTruthy();
  });

  it("compares the two latest years by default and flags better/worse", async () => {
    render(wrap(<SchoolYearSection />));
    const table = await screen.findByTestId("school-year-compare");
    const passRate = within(table).getByText("Pass rate").closest("tr") as HTMLElement;
    // 2025 (70%) vs 2024 (60%): +10.0, better.
    expect(within(passRate).getByText("+10.0").getAttribute("data-trend")).toBe("better");
    const flagged = within(table).getByText("Flagged rate").closest("tr") as HTMLElement;
    // Flagged rate fell from 20% to 10%: improvement.
    expect(within(flagged).getByText("−10.0").getAttribute("data-trend")).toBe("better");
  });

  it("recomputes the comparison when other years are picked", async () => {
    render(wrap(<SchoolYearSection />));
    await screen.findByTestId("school-year-compare");
    fireEvent.change(screen.getByLabelText("Compare from"), { target: { value: "2023" } });
    const table = screen.getByTestId("school-year-compare");
    const passRate = within(table).getByText("Pass rate").closest("tr") as HTMLElement;
    expect(within(passRate).getByText("+20.0")).toBeTruthy();
  });

  it("loads the per-exam breakdown for the newest year", async () => {
    render(wrap(<SchoolYearSection />));
    await waitFor(() => expect(api.fetchSchoolYearDetail).toHaveBeenCalledWith(2025));
    expect(await screen.findByText("Entrance Exam")).toBeTruthy();
  });

  it("says so when no year has completed results", async () => {
    vi.mocked(api.fetchSchoolYearReport).mockResolvedValue({ start_month: 6, years: [] });
    render(wrap(<SchoolYearSection />));
    expect(await screen.findByText("No school year has completed exam results yet.")).toBeTruthy();
  });
});
