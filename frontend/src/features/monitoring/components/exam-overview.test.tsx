import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { ExamGroup } from "@/features/monitoring/lib/exam-groups";

import { ExamOverview, examMonitoringPath } from "./exam-overview";

function group(over: Partial<ExamGroup>): ExamGroup {
  return {
    examId: 1,
    title: "Algebra",
    department: "COE",
    sessions: [],
    live: 3,
    paused: 1,
    flagged: 2,
    alerts: 5,
    avgEbi: 72.4,
    startedAt: null,
    ...over,
  };
}

function renderOverview(groups: ExamGroup[]) {
  return render(
    <MemoryRouter>
      <ExamOverview groups={groups} />
    </MemoryRouter>,
  );
}

describe("ExamOverview", () => {
  afterEach(cleanup);

  it("shows one card per ongoing exam, linking to that exam's candidates", () => {
    renderOverview([group({ examId: 7, title: "Biology" }), group({ examId: 9, title: "Chemistry" })]);

    const biology = screen.getByRole("link", { name: "Monitor Biology" });
    expect(biology).toHaveAttribute("href", examMonitoringPath(7));
    expect(biology).toHaveAttribute("href", "/monitoring?exam=7");
    expect(screen.getByRole("link", { name: "Monitor Chemistry" })).toHaveAttribute(
      "href",
      "/monitoring?exam=9",
    );
  });

  it("summarises live, paused and flagged candidates and the unresolved alerts", () => {
    renderOverview([group({})]);
    const card = screen.getByRole("link", { name: "Monitor Algebra" });

    const figures = within(card).getAllByRole("definition").map((d) => d.textContent);
    expect(figures).toEqual(["3", "1", "2"]);
    expect(card).toHaveTextContent("Avg EBI 72%");
    expect(card).toHaveTextContent("5 unresolved alerts");
  });

  it("says so when nobody has an EBI yet and stays quiet about alerts when there are none", () => {
    renderOverview([group({ avgEbi: null, alerts: 0, flagged: 0 })]);
    const card = screen.getByRole("link", { name: "Monitor Algebra" });
    expect(card).toHaveTextContent("No EBI yet");
    expect(card).not.toHaveTextContent("unresolved");
  });
});
