import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ExamSection, Question, QuestionAttachment } from "@/core/config/api";
import { QuestionFormDialog } from "@/features/exams/components/builder/question-form-dialog";
import { EMPTY_QUESTION, type QuestionDraft } from "@/features/exams/schemas/builder-schemas";

beforeAll(() => {
  // jsdom doesn't implement object URLs; the pending-picture preview uses them.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

const partA: ExamSection = { id: 1, title: "Part A", order: 1 };

function Harness({
  sections = [partA],
  attachments = [],
  initialPending = [],
  editing = null,
  error = null,
  onCreateSection = vi.fn(async () => null),
  onAttachmentPick = vi.fn(),
  onRemoveAttachment = vi.fn(),
  onDraftChange,
}: {
  sections?: ExamSection[];
  attachments?: QuestionAttachment[];
  initialPending?: File[];
  editing?: Question | null;
  error?: string | null;
  onCreateSection?: (title: string) => Promise<ExamSection | null>;
  onAttachmentPick?: (files: FileList | null) => void;
  onRemoveAttachment?: (a: QuestionAttachment) => void;
  onDraftChange?: (draft: QuestionDraft) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [pending, setPending] = useState<File[]>(initialPending);
  onDraftChange?.(draft);
  return (
    <QuestionFormDialog
      open
      editingQuestion={editing}
      questionDraft={draft}
      setQuestionDraft={setDraft}
      sections={sections}
      questionAttachments={attachments}
      pendingFiles={pending}
      setPendingFiles={setPending}
      attachmentBusy={false}
      error={error}
      saving={false}
      onClose={vi.fn()}
      onSave={vi.fn()}
      onAttachmentPick={onAttachmentPick}
      onRemoveAttachment={onRemoveAttachment}
      onUploadOptionImage={vi.fn(async () => "")}
      onCreateSection={onCreateSection}
    />
  );
}

const sectionSelect = () => screen.getByLabelText(/Section \(for in-exam navigation\)/);

describe("QuestionFormDialog - section dropdown", () => {
  it("offers an Add section option after the existing sections", () => {
    render(<Harness />);
    const labels = Array.from((sectionSelect() as HTMLSelectElement).options).map((o) => o.text);
    expect(labels).toEqual(["No section", "Part A", "+ Add section…"]);
  });

  it("creates a section inline and selects it", async () => {
    const created: ExamSection = { id: 9, title: "Part B", order: 2 };
    const onCreateSection = vi.fn(async () => created);
    let latest: QuestionDraft = EMPTY_QUESTION;
    render(
      <Harness
        sections={[partA, created]}
        onCreateSection={onCreateSection}
        onDraftChange={(d) => {
          latest = d;
        }}
      />
    );

    fireEvent.change(sectionSelect(), { target: { value: "__new_section__" } });
    fireEvent.change(screen.getByLabelText("New section title"), { target: { value: "  Part B " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(latest.section).toBe(9));
    expect(onCreateSection).toHaveBeenCalledWith("  Part B ");
    expect((sectionSelect() as HTMLSelectElement).value).toBe("9");
    expect(screen.queryByLabelText("New section title")).not.toBeInTheDocument();
  });

  it("keeps the form open and the section unset when creation fails", async () => {
    const onCreateSection = vi.fn(async () => null);
    let latest: QuestionDraft = EMPTY_QUESTION;
    render(
      <Harness
        onCreateSection={onCreateSection}
        onDraftChange={(d) => {
          latest = d;
        }}
      />
    );

    fireEvent.change(sectionSelect(), { target: { value: "__new_section__" } });
    fireEvent.change(screen.getByLabelText("New section title"), { target: { value: "Part B" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreateSection).toHaveBeenCalled());
    expect(latest.section).toBeNull();
    expect(screen.getByLabelText("New section title")).toBeInTheDocument();
  });

  it("does not create a section for a blank title", () => {
    const onCreateSection = vi.fn(async () => null);
    render(<Harness onCreateSection={onCreateSection} />);
    fireEvent.change(sectionSelect(), { target: { value: "__new_section__" } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("returns to the plain dropdown on cancel", () => {
    render(<Harness />);
    fireEvent.change(sectionSelect(), { target: { value: "__new_section__" } });
    // The inline Cancel renders before the dialog footer's own Cancel button.
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(screen.queryByLabelText("New section title")).not.toBeInTheDocument();
  });
});

describe("QuestionFormDialog - question picture", () => {
  it("shows a picture picker limited to picture types", () => {
    render(<Harness />);
    expect(screen.getByText("Question picture")).toBeInTheDocument();
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const pictureInput = Array.from(inputs).find((i) => i.accept.includes("image/png"));
    expect(pictureInput?.accept).toBe("image/jpeg,image/png,image/gif,image/webp");
  });

  it("previews a picture that is waiting for the question to be saved", () => {
    render(<Harness initialPending={[new File(["x"], "diagram.png", { type: "image/png" })]} />);
    expect(screen.getByAltText("diagram.png")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("Pending save")).toBeInTheDocument();
  });

  it("removes a pending picture", () => {
    render(<Harness initialPending={[new File(["x"], "diagram.png", { type: "image/png" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    expect(screen.queryByAltText("diagram.png")).not.toBeInTheDocument();
  });

  it("shows saved pictures separately from PDF/audio attachments", () => {
    const attachments: QuestionAttachment[] = [
      { id: 1, kind: "image", url: "https://api.example.com/media/a.png", caption: "", order: 0 },
      { id: 2, kind: "pdf", url: "https://api.example.com/media/spec.pdf", caption: "", order: 1 },
    ];
    render(<Harness attachments={attachments} />);
    expect(screen.getByAltText("Question picture")).toHaveAttribute(
      "src",
      "https://api.example.com/media/a.png"
    );
    expect(screen.getByText("spec.pdf")).toBeInTheDocument();
  });

  it("surfaces errors inside the dialog", () => {
    render(<Harness error="Could not upload it." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not upload it.");
  });
});
