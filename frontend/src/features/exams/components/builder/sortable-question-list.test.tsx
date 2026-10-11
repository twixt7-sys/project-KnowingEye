import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Question } from "@/core/config/api";
import { SortableQuestionList } from "./sortable-question-list";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const questions = [
  { id: 9, order: 1, question_text: "First", question_type: "essay", points: 1, options: [] },
  { id: 10, order: 2, question_text: "Second", question_type: "essay", points: 1, options: [] },
] as unknown as Question[];

function renderList(props: { editable: boolean; previewExamId?: number }) {
  render(
    <MemoryRouter>
      <SortableQuestionList
        questions={questions}
        sectionTitleById={new Map()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("SortableQuestionList - preview links", () => {
  it("links each question to its own place in the preview", () => {
    renderList({ editable: false, previewExamId: 5 });
    const links = screen.getAllByRole("link", { name: "Preview" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/examiner/exams/5/preview?q=9",
      "/examiner/exams/5/preview?q=10",
    ]);
  });

  it("offers preview on a locked list, where Edit and Delete are hidden", () => {
    renderList({ editable: false, previewExamId: 5 });
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("sits beside Edit and Delete when the list is editable", () => {
    renderList({ editable: true, previewExamId: 5 });
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("is absent when the user may not preview the exam", () => {
    renderList({ editable: true });
    expect(screen.queryByRole("link", { name: "Preview" })).not.toBeInTheDocument();
  });
});
