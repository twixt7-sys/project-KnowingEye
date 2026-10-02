import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ApiError,
  formatApiError,
  type ExamSection,
  type Question,
  type QuestionAttachment,
} from "@/core/config/api";
import {
  type ExamAssignment,
  approveExam,
  createExamAssignment,
  createExamSection,
  createQuestion,
  deleteExamSection,
  deleteQuestion,
  deleteQuestionAttachment,
  checkQuestionRows,
  importExamAssignments,
  importQuestionRows,
  publishExam,
  rejectExam,
  reorderQuestions,
  submitExamForReview,
  updateExam,
  updateExamSection,
  updateQuestion,
  uploadOptionImage,
  uploadQuestionAttachment,
} from "@/features/exams/api/exam-api";
import { validateAttachment } from "@/features/exams/lib/attachment-rules";
import { optionsToDraft, optionsToPayload } from "@/features/exams/lib/question-options";
import { examBuilderKeys } from "@/features/exams/queries/keys";
import { examBuilderQueries } from "@/features/exams/queries/queries";
import {
  downloadQuestionForm,
  type ParsedQuestionForm,
  parseQuestionImportFile,
  QuestionFormError,
} from "@/features/exams/lib/question-import-form";
import {
  extractImportProblems,
  type ImportProblems,
} from "@/features/exams/lib/question-import-issues";
import {
  EMPTY_QUESTION,
  examFormToPayload,
  examToForm,
  toDatetimeLocal,
  type BuilderTab,
  type ExamForm,
  type QuestionDraft,
} from "@/features/exams/schemas/builder-schemas";
import { useConfirm } from "@/shared/components/common/confirm-dialog";

/** Where the uploaded question form is in the check → import flow. */
export type ImportCheckStatus = "idle" | "checking" | "valid" | "invalid";

const NO_PROBLEMS: ImportProblems = { issues: [], general: [] };

// Module-level so `data ?? EMPTY` keeps a stable reference while a query has no data yet.
const NO_QUESTIONS: Question[] = [];
const NO_ASSIGNMENTS: ExamAssignment[] = [];
const NO_SECTIONS: ExamSection[] = [];

function formatQueryError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.detail();
  if (err) return formatApiError(err, fallback);
  return fallback;
}

export function useExamBuilder(examId: number) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<BuilderTab>("settings");
  const [form, setForm] = useState<ExamForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Errors raised while the question dialog is open. The page-level banner sits
  // underneath the modal overlay, so these are rendered inside the dialog.
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [questionAttachments, setQuestionAttachments] = useState<QuestionAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  const [importForm, setImportForm] = useState<ParsedQuestionForm | null>(null);
  const [importStatus, setImportStatus] = useState<ImportCheckStatus>("idle");
  const [importProblems, setImportProblems] = useState<ImportProblems>(NO_PROBLEMS);
  const [formDownloadBusy, setFormDownloadBusy] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateCsv, setCandidateCsv] = useState("email,extra_time_minutes,seat_label\n");

  const examQuery = useQuery(examBuilderQueries.exam(examId));
  const questionsQuery = useQuery(examBuilderQueries.questions(examId));
  const readinessQuery = useQuery(examBuilderQueries.readiness(examId));
  const assignmentsQuery = useQuery(examBuilderQueries.assignments(examId));
  const sectionsQuery = useQuery(examBuilderQueries.sections(examId));

  const exam = examQuery.data ?? null;
  const questions = questionsQuery.data ?? NO_QUESTIONS;
  const readiness = readinessQuery.data ?? null;
  const assignments = assignmentsQuery.data ?? NO_ASSIGNMENTS;
  const sections = sectionsQuery.data ?? NO_SECTIONS;

  const loading =
    examQuery.isLoading ||
    questionsQuery.isLoading ||
    readinessQuery.isLoading ||
    assignmentsQuery.isLoading;

  const loadError = examQuery.error
    ? formatQueryError(examQuery.error, "Failed to load exam")
    : null;

  const error = actionError ?? (exam ? null : loadError);

  useEffect(() => {
    if (exam) {
      setForm(examToForm(exam));
    }
  }, [exam]);

  const invalidateBuilder = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.detail(examId) }),
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.questions(examId) }),
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.readiness(examId) }),
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.assignments(examId) }),
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.sections(examId) }),
    ]);
  }, [examId, queryClient]);

  const isDraft = exam?.status === "draft";
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points || 0), 0),
    [questions]
  );

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: ExamForm) => updateExam(examId, examFormToPayload(payload)),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async () => {
      setMessage("Exam settings saved.");
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e, "Could not save settings")),
  });

  const saveQuestionMutation = useMutation({
    mutationFn: async ({
      draft,
      editing,
      pending,
    }: {
      draft: QuestionDraft;
      editing: Question | null;
      pending: File[];
    }) => {
      const payload = {
        question_text: draft.question_text,
        question_type: draft.question_type,
        options: draft.question_type === "multiple_choice" ? optionsToPayload(draft.options) : [],
        correct_answer: draft.correct_answer,
        points: draft.points,
        section: draft.section,
      };
      if (editing) {
        await updateQuestion(examId, editing.id, payload);
        return { created: false, failedUploads: [] as string[] };
      }
      const created = await createQuestion(examId, payload);
      // The question now exists, so an upload failure must not fail the whole
      // save - a retry would create a duplicate question. Report it instead.
      const failedUploads: string[] = [];
      for (const file of pending) {
        try {
          await uploadQuestionAttachment(examId, created.id, file);
        } catch {
          failedUploads.push(file.name);
        }
      }
      return { created: true, failedUploads };
    },
    onMutate: () => {
      setActionError(null);
      setQuestionError(null);
    },
    onSuccess: async ({ created, failedUploads }) => {
      setShowQuestionForm(false);
      if (failedUploads.length) {
        setMessage(null);
        setActionError(
          `Question added, but ${failedUploads.length} file(s) could not be uploaded ` +
            `(${failedUploads.join(", ")}). Edit the question to attach them again.`
        );
      } else {
        setMessage(created ? "Question added." : "Question updated.");
      }
      await invalidateBuilder();
    },
    onError: (e) => setQuestionError(formatApiError(e)),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => deleteQuestion(examId, questionId),
    onError: (e) => setActionError(formatApiError(e)),
    onSuccess: () => invalidateBuilder(),
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: number[]) => reorderQuestions(examId, questionIds),
    onMutate: async (questionIds) => {
      await queryClient.cancelQueries({ queryKey: examBuilderKeys.questions(examId) });
      const previous = queryClient.getQueryData<Question[]>(examBuilderKeys.questions(examId));
      if (previous) {
        const byId = new Map(previous.map((q) => [q.id, q]));
        const optimistic = questionIds
          .map((id, index) => {
            const q = byId.get(id);
            return q ? { ...q, order: index + 1 } : null;
          })
          .filter((q): q is Question => q !== null);
        queryClient.setQueryData(examBuilderKeys.questions(examId), optimistic);
      }
      return { previous };
    },
    onError: (e, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(examBuilderKeys.questions(examId), context.previous);
      }
      setActionError(formatApiError(e, "Reorder failed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: examBuilderKeys.questions(examId) });
    },
  });

  const checkImportMutation = useMutation({
    mutationFn: (form: ParsedQuestionForm) => checkQuestionRows(examId, form.rows),
    onMutate: () => {
      setImportStatus("checking");
      setImportProblems(NO_PROBLEMS);
    },
    onSuccess: () => setImportStatus("valid"),
    onError: (e) => {
      setImportProblems(extractImportProblems(e));
      setImportStatus("invalid");
    },
  });

  const importQuestionsMutation = useMutation({
    mutationFn: (form: ParsedQuestionForm) => importQuestionRows(examId, form.rows),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async (res, form) => {
      setImportForm(null);
      setImportStatus("idle");
      setImportProblems(NO_PROBLEMS);
      setMessage(
        `Imported ${res.imported} question${res.imported === 1 ? "" : "s"} from "${form.fileName}".`
      );
      await invalidateBuilder();
    },
    onError: (e) => {
      // The exam can change between the check and the import; show what's wrong now.
      setImportProblems(extractImportProblems(e));
      setImportStatus("invalid");
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishExam(examId),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async () => {
      setMessage("Exam published - examinees can take it during the scheduled window.");
      await invalidateBuilder();
    },
    onError: async (e) => {
      setActionError(formatApiError(e, "Publish failed"));
      await queryClient.invalidateQueries({ queryKey: examBuilderKeys.readiness(examId) });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitExamForReview(examId),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async (res) => {
      setMessage(res.message);
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e, "Submit for review failed")),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveExam(examId),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async (res) => {
      setMessage(res.message);
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e, "Approve failed")),
  });

  const rejectMutation = useMutation({
    mutationFn: (note: string) => rejectExam(examId, note),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
    },
    onSuccess: async (res) => {
      setMessage(res.message);
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e, "Reject failed")),
  });

  const createSectionMutation = useMutation({
    mutationFn: (payload: { title: string; instructions?: string }) =>
      createExamSection(examId, payload),
    onSuccess: async () => {
      await invalidateBuilder();
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      payload,
    }: {
      sectionId: number;
      payload: { title?: string; instructions?: string; order?: number };
    }) => updateExamSection(examId, sectionId, payload),
    onSuccess: async () => {
      setMessage("Section updated.");
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e)),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: number) => deleteExamSection(examId, sectionId),
    onSuccess: async () => {
      setMessage("Section removed. Its questions are now unsectioned.");
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e)),
  });

  const addCandidateMutation = useMutation({
    mutationFn: (email: string) => createExamAssignment(examId, { email }),
    onSuccess: async () => {
      setCandidateEmail("");
      setMessage("Candidate added.");
      await queryClient.invalidateQueries({ queryKey: examBuilderKeys.assignments(examId) });
    },
    onError: (e) => setActionError(formatApiError(e)),
  });

  const importCandidatesMutation = useMutation({
    mutationFn: (csv: string) => importExamAssignments(examId, csv),
    onSuccess: async (res) => {
      setMessage(`Imported ${res.created} new, updated ${res.updated}.`);
      await queryClient.invalidateQueries({ queryKey: examBuilderKeys.assignments(examId) });
    },
    onError: (e) => setActionError(formatApiError(e)),
  });

  const saving =
    saveSettingsMutation.isPending ||
    saveQuestionMutation.isPending ||
    publishMutation.isPending;

  // `mutate` is referentially stable in react-query v5, unlike the mutation result object.
  const saveSettingsMutate = saveSettingsMutation.mutate;
  const saveQuestionMutate = saveQuestionMutation.mutate;
  const deleteQuestionMutate = deleteQuestionMutation.mutate;
  const reorderMutate = reorderMutation.mutate;
  const checkImportMutate = checkImportMutation.mutate;
  const importQuestionsMutate = importQuestionsMutation.mutate;
  const publishMutate = publishMutation.mutate;
  const submitMutate = submitMutation.mutate;
  const approveMutate = approveMutation.mutate;
  const rejectMutate = rejectMutation.mutate;
  const createSectionMutateAsync = createSectionMutation.mutateAsync;
  const createSectionMutate = createSectionMutation.mutate;
  const updateSectionMutate = updateSectionMutation.mutate;
  const deleteSectionMutate = deleteSectionMutation.mutate;
  const addCandidateMutate = addCandidateMutation.mutate;
  const importCandidatesMutate = importCandidatesMutation.mutate;

  const saveSettings = useCallback(() => {
    if (!form) return;
    if (!form.available_from) {
      setActionError("Set an opening date before saving.");
      return;
    }
    if (!form.available_until) {
      setActionError("Set a closing date before saving.");
      return;
    }
    const openingChanged = !exam || toDatetimeLocal(exam.available_from) !== form.available_from;
    if (openingChanged && new Date(form.available_from) < new Date()) {
      setActionError("The opening date can't be in the past.");
      return;
    }
    if (new Date(form.available_until) <= new Date(form.available_from)) {
      setActionError("The closing date must be after the opening date.");
      return;
    }
    saveSettingsMutate(form);
  }, [form, exam, saveSettingsMutate]);

  const openNewQuestion = useCallback(() => {
    setQuestionError(null);
    setEditingQuestion(null);
    setQuestionDraft({ ...EMPTY_QUESTION, options: EMPTY_QUESTION.options.map((o) => ({ ...o })) });
    setQuestionAttachments([]);
    setPendingFiles([]);
    setShowQuestionForm(true);
  }, []);

  const openEditQuestion = useCallback((q: Question) => {
    setQuestionError(null);
    setEditingQuestion(q);
    const saved = optionsToDraft(q.options ?? [], q.correct_answer ?? "");
    setQuestionDraft({
      question_text: q.question_text,
      question_type: q.question_type,
      options: saved.options.length
        ? saved.options
        : [{ text: "", image: null }, { text: "", image: null }],
      correct_answer: saved.correct_answer,
      points: q.points,
      section: q.section ?? null,
    });
    setQuestionAttachments(q.attachments ?? []);
    setPendingFiles([]);
    setShowQuestionForm(true);
  }, []);

  const closeQuestionForm = useCallback(() => setShowQuestionForm(false), []);

  const uploadOptionImageForQuestion = useCallback(async (file: File) => {
    const { url } = await uploadOptionImage(examId, file);
    return url;
  }, [examId]);

  const uploadAttachment = useCallback(async (questionId: number, file: File) => {
    setAttachmentBusy(true);
    try {
      const attachment = await uploadQuestionAttachment(examId, questionId, file);
      setQuestionAttachments((prev) => [...prev, attachment]);
    } catch (e: unknown) {
      setQuestionError(formatApiError(e, `Could not upload "${file.name}".`));
    } finally {
      setAttachmentBusy(false);
    }
  }, [examId]);

  const removeAttachment = useCallback(async (attachment: QuestionAttachment) => {
    if (!editingQuestion) return;
    const confirmed = await confirm({
      title: "Remove attachment?",
      description: "This permanently deletes the attached file from the question.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    setAttachmentBusy(true);
    try {
      await deleteQuestionAttachment(examId, editingQuestion.id, attachment.id);
      setQuestionAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (e: unknown) {
      setQuestionError(formatApiError(e));
    } finally {
      setAttachmentBusy(false);
    }
  }, [confirm, editingQuestion, examId]);

  const handleAttachmentPick = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setQuestionError(null);
    const problems: string[] = [];
    const picked = Array.from(files).filter((file) => {
      const problem = validateAttachment(file);
      if (problem) problems.push(problem);
      return !problem;
    });
    if (problems.length) setQuestionError(problems.join(" "));
    if (editingQuestion) {
      for (const file of picked) {
        await uploadAttachment(editingQuestion.id, file);
      }
    } else {
      setPendingFiles((prev) => [...prev, ...picked]);
    }
  }, [editingQuestion, uploadAttachment]);

  const saveQuestion = useCallback(() => {
    saveQuestionMutate({
      draft: questionDraft,
      editing: editingQuestion,
      pending: pendingFiles,
    });
  }, [saveQuestionMutate, questionDraft, editingQuestion, pendingFiles]);

  const removeQuestion = useCallback(async (q: Question) => {
    const confirmed = await confirm({
      title: `Delete question ${q.order}?`,
      description: "This permanently removes the question and its attachments.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    deleteQuestionMutate(q.id);
  }, [confirm, deleteQuestionMutate]);

  const reorderQuestionsByIds = useCallback((questionIds: number[]) => {
    reorderMutate(questionIds);
  }, [reorderMutate]);

  const downloadImportForm = useCallback(async () => {
    if (!exam) return;
    setActionError(null);
    setFormDownloadBusy(true);
    try {
      await downloadQuestionForm(exam);
    } catch {
      setActionError("Could not generate the question form. Please try again.");
    } finally {
      setFormDownloadBusy(false);
    }
  }, [exam]);

  const handleImportFile = useCallback(async (file: File) => {
    setActionError(null);
    setMessage(null);
    setImportForm(null);
    setImportProblems(NO_PROBLEMS);
    setImportStatus("checking");
    let parsed: ParsedQuestionForm;
    try {
      parsed = await parseQuestionImportFile(file);
    } catch (e: unknown) {
      setImportForm({ fileName: file.name, rows: [], formExamId: null, formExamLabel: null });
      setImportProblems({
        issues: [],
        general: [
          e instanceof QuestionFormError
            ? e.message
            : "Could not read that file. Upload the completed question form (.xlsx).",
        ],
      });
      setImportStatus("invalid");
      return;
    }
    setImportForm(parsed);
    if (!parsed.rows.length) {
      setImportProblems({
        issues: [],
        general: ["The form has no questions filled in. Add at least one row, then upload it again."],
      });
      setImportStatus("invalid");
      return;
    }
    checkImportMutate(parsed);
  }, [checkImportMutate]);

  const recheckImport = useCallback(() => {
    if (importForm?.rows.length) checkImportMutate(importForm);
  }, [importForm, checkImportMutate]);

  const clearImport = useCallback(() => {
    setImportForm(null);
    setImportStatus("idle");
    setImportProblems(NO_PROBLEMS);
  }, []);

  const runImport = useCallback(() => {
    if (!importForm || importStatus !== "valid") return;
    importQuestionsMutate(importForm);
  }, [importForm, importStatus, importQuestionsMutate]);

  const publish = useCallback(() => publishMutate(), [publishMutate]);

  const submitForReview = useCallback(() => submitMutate(), [submitMutate]);

  const approveReview = useCallback(() => approveMutate(), [approveMutate]);

  const rejectReview = useCallback((note: string) => rejectMutate(note), [rejectMutate]);

  const addCandidate = useCallback(() => {
    if (!candidateEmail.trim()) return;
    addCandidateMutate(candidateEmail.trim());
  }, [candidateEmail, addCandidateMutate]);

  const importCandidates = useCallback(
    () => importCandidatesMutate(candidateCsv),
    [candidateCsv, importCandidatesMutate]
  );

  const addSection = useCallback((title: string, instructions?: string) => {
    if (!title.trim()) return;
    createSectionMutate(
      { title: title.trim(), instructions: instructions?.trim() },
      {
        onSuccess: () =>
          setMessage("Section created. Assign questions to it from the question editor."),
        onError: (e) => setActionError(formatApiError(e)),
      }
    );
  }, [createSectionMutate]);

  /** Creates a section from inside the question dialog; resolves to it (or null on failure). */
  const createSectionForQuestion = useCallback(async (title: string): Promise<ExamSection | null> => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    setQuestionError(null);
    try {
      return await createSectionMutateAsync({ title: trimmed });
    } catch (e) {
      setQuestionError(formatApiError(e, "Could not create the section."));
      return null;
    }
  }, [createSectionMutateAsync]);

  const renameSection = useCallback((sectionId: number, title: string) => {
    if (!title.trim()) return;
    updateSectionMutate({ sectionId, payload: { title: title.trim() } });
  }, [updateSectionMutate]);

  const removeSection = useCallback(async (sectionId: number, title: string) => {
    const confirmed = await confirm({
      title: `Remove section "${title}"?`,
      description: "Questions in this section become unsectioned - they are not deleted.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    deleteSectionMutate(sectionId);
  }, [confirm, deleteSectionMutate]);

  return {
    tab,
    setTab,
    exam,
    form,
    setForm,
    questions,
    readiness,
    assignments,
    sections,
    loading,
    loadError,
    error,
    message,
    setMessage,
    isDraft,
    totalPoints,
    saving,
    saveSettings,
    showQuestionForm,
    closeQuestionForm,
    editingQuestion,
    questionDraft,
    setQuestionDraft,
    questionAttachments,
    questionError,
    pendingFiles,
    setPendingFiles,
    attachmentBusy,
    openNewQuestion,
    openEditQuestion,
    handleAttachmentPick,
    removeAttachment,
    uploadOptionImageForQuestion,
    saveQuestion,
    removeQuestion,
    reorderQuestionsByIds,
    importForm,
    importStatus,
    importProblems,
    importBusy: importQuestionsMutation.isPending,
    formDownloadBusy,
    downloadImportForm,
    handleImportFile,
    recheckImport,
    clearImport,
    runImport,
    publish,
    submitForReview,
    submitPending: submitMutation.isPending,
    approveReview,
    approvePending: approveMutation.isPending,
    rejectReview,
    rejectPending: rejectMutation.isPending,
    candidateEmail,
    setCandidateEmail,
    candidateCsv,
    setCandidateCsv,
    addCandidate,
    importCandidates,
    addSection,
    createSectionForQuestion,
    renameSection,
    removeSection,
    createSectionPending: createSectionMutation.isPending,
    updateSectionPending: updateSectionMutation.isPending,
    deleteSectionPending: deleteSectionMutation.isPending,
    addCandidatePending: addCandidateMutation.isPending,
    importCandidatesPending: importCandidatesMutation.isPending,
  };
}
