import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Exam } from "@/core/config/api";
import { BuilderSettingsTab } from "@/features/exams/components/builder/builder-settings-tab";
import { ExamEditLockNotice } from "@/features/exams/components/builder/exam-edit-lock-notice";
import { examToForm } from "@/features/exams/schemas/builder-schemas";

// The settings tab loads categories/departments; nothing under test needs them.
vi.mock("@/features/dashboard/queries/queries", () => {
  const idle = () => ({ queryKey: ["idle"], queryFn: async () => [], enabled: false });
  return { dashboardQueries: { categories: idle, departments: idle } };
});

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const exam = (over: Partial<Exam> = {}): Exam => ({
  id: 9,
  title: "ZZ Entrance",
  description: "",
  duration_minutes: 60,
  total_questions: 2,
  passing_score: 50,
  status: "active",
  created_at: "2026-10-01T00:00:00Z",
  available_from: "2026-11-01T01:00:00Z",
  available_until: "2026-11-02T01:00:00Z",
  edit_lock: "published",
  edit_lock_message: "This exam is published. Unpublish this exam to edit it.",
  can_unpublish: true,
  ...over,
});

function renderNotice(e: Exam, onCandidatesTab = false) {
  const handlers = { onUnpublish: vi.fn(), onEditCandidates: vi.fn() };
  render(
    <ExamEditLockNotice
      exam={e}
      onCandidatesTab={onCandidatesTab}
      unpublishPending={false}
      {...handlers}
    />,
  );
  return handlers;
}

describe("ExamEditLockNotice", () => {
  it("shows nothing for an editable draft", () => {
    renderNotice(exam({ status: "draft", edit_lock: null, can_unpublish: false }));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("asks to unpublish a published exam and offers the button", () => {
    const { onUnpublish } = renderNotice(exam());
    expect(screen.getByText("Unpublish this exam to edit it")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /unpublish to edit/i }));
    expect(onUnpublish).toHaveBeenCalledOnce();
  });

  it("explains a published exam that was already taken can't be unpublished", () => {
    renderNotice(exam({ can_unpublish: false }));
    expect(screen.queryByRole("button", { name: /unpublish/i })).toBeNull();
    expect(screen.getByText(/can't be unpublished/i)).toBeTruthy();
  });

  it("says only candidates can be edited while the exam is in progress", () => {
    const { onEditCandidates } = renderNotice(exam({ edit_lock: "ongoing", can_unpublish: false }));
    expect(screen.getByText("Exam in progress: only candidates can be edited")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /unpublish/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /edit candidates/i }));
    expect(onEditCandidates).toHaveBeenCalledOnce();
  });

  it("confirms candidates stay editable on the candidates tab of an ongoing exam", () => {
    renderNotice(exam({ edit_lock: "ongoing", can_unpublish: false }), true);
    expect(screen.getByText(/you can still add and update candidates/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays out of the way on the candidates tab of a published exam", () => {
    renderNotice(exam(), true);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("points an archived exam at unarchiving", () => {
    renderNotice(exam({ status: "archived", edit_lock: "archived", can_unpublish: false }));
    expect(screen.getByText("This exam is archived")).toBeTruthy();
  });
});

function renderSettings(e: Exam, editable: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BuilderSettingsTab
        exam={e}
        form={examToForm(e)}
        setForm={vi.fn()}
        editable={editable}
        saving={false}
        onSave={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("BuilderSettingsTab lock", () => {
  it("lets a draft be edited and saved", () => {
    renderSettings(exam({ status: "draft", edit_lock: null }), true);
    expect((screen.getByDisplayValue("ZZ Entrance") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: /save settings/i })).toBeTruthy();
  });

  it("disables every field and hides Save when locked, showing the server's reason", () => {
    const e = exam({
      edit_lock: "ongoing",
      edit_lock_message: "Exam in progress: only candidates can be edited.",
    });
    renderSettings(e, false);
    expect((screen.getByDisplayValue("ZZ Entrance") as HTMLInputElement).disabled).toBe(true);
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box.hasAttribute("disabled") || box.getAttribute("aria-disabled") === "true").toBe(true);
    }
    expect(screen.queryByRole("button", { name: /save settings/i })).toBeNull();
    expect(screen.getByText("Exam in progress: only candidates can be edited.")).toBeTruthy();
  });
});
