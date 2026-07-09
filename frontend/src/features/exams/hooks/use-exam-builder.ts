import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, formatApiError, type Question, type QuestionAttachment } from "@/core/config/api";
import {
  createExamAssignment,
  createExamSection,
  createQuestion,
  deleteQuestion,
  deleteQuestionAttachment,
  importExamAssignments,
  importQuestionsCsv,
  publishExam,
  reorderQuestions,
  updateExam,
  updateQuestion,
  uploadQuestionAttachment,
} from "@/features/exams/api/exam-api";
import { examBuilderKeys } from "@/features/exams/queries/keys";
import { examBuilderQueries } from "@/features/exams/queries/queries";
import { CSV_TEMPLATE, readImportFileAsCsv } from "@/features/exams/lib/question-import-template";
import {
  EMPTY_QUESTION,
  examFormToPayload,
  examToForm,
  type BuilderTab,
  type ExamForm,
  type QuestionDraft,
} from "@/features/exams/schemas/builder-schemas";
import { useConfirm } from "@/shared/components/common/confirm-dialog";

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

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [questionAttachments, setQuestionAttachments] = useState<QuestionAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  const [importCsv, setImportCsv] = useState(CSV_TEMPLATE);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateCsv, setCandidateCsv] = useState("email,extra_time_minutes\n");

  const examQuery = useQuery(examBuilderQueries.exam(examId));
  const questionsQuery = useQuery(examBuilderQueries.questions(examId));
  const readinessQuery = useQuery(examBuilderQueries.readiness(examId));
  const assignmentsQuery = useQuery(examBuilderQueries.assignments(examId));

  const exam = examQuery.data ?? null;
  const questions = questionsQuery.data ?? [];
  const readiness = readinessQuery.data ?? null;
  const assignments = assignmentsQuery.data ?? [];

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
        options:
          draft.question_type === "multiple_choice"
            ? draft.options.filter((o) => o.trim())
            : [],
        correct_answer: draft.correct_answer,
        points: draft.points,
      };
      if (editing) {
        await updateQuestion(examId, editing.id, payload);
        return { created: false };
      }
      const created = await createQuestion(examId, payload);
      for (const file of pending) {
        await uploadQuestionAttachment(examId, created.id, file);
      }
      return { created: true };
    },
    onMutate: () => setActionError(null),
    onSuccess: async ({ created }) => {
      setShowQuestionForm(false);
      setMessage(created ? "Question added." : "Question updated.");
      await invalidateBuilder();
    },
    onError: (e) => setActionError(formatApiError(e)),
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

  const importQuestionsMutation = useMutation({
    mutationFn: (csv: string) => importQuestionsCsv(examId, csv),
    onMutate: () => {
      setActionError(null);
      setMessage(null);
      setImportErrors([]);
    },
    onSuccess: async (res) => {
      setMessage(`Imported ${res.imported} question(s).`);
      await invalidateBuilder();
    },
    onError: (e) => {
      const payload = (e as { payload?: { errors?: unknown } } | null)?.payload;
      const rowErrors = payload?.errors;
      if (Array.isArray(rowErrors) && rowErrors.length) {
        setImportErrors(rowErrors.map((m) => String(m)));
      } else {
        setActionError(formatApiError(e, "Import failed"));
      }
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

  const createSectionMutation = useMutation({
    mutationFn: (title: string) => createExamSection(examId, { title }),
    onSuccess: () => setMessage("Section created. Assign questions to it when editing."),
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

  const saveSettings = () => {
    if (!form) return;
    saveSettingsMutation.mutate(form);
  };

  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQuestionDraft({ ...EMPTY_QUESTION, options: ["", "", "", ""] });
    setQuestionAttachments([]);
    setPendingFiles([]);
    setShowQuestionForm(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionDraft({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options?.length ? [...q.options] : ["", ""],
      correct_answer: q.correct_answer ?? "",
      points: q.points,
    });
    setQuestionAttachments(q.attachments ?? []);
    setPendingFiles([]);
    setShowQuestionForm(true);
  };

  const uploadAttachment = async (questionId: number, file: File) => {
    setAttachmentBusy(true);
    try {
      const attachment = await uploadQuestionAttachment(examId, questionId, file);
      setQuestionAttachments((prev) => [...prev, attachment]);
    } catch (e: unknown) {
      setActionError(formatApiError(e));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async (attachment: QuestionAttachment) => {
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
      setActionError(formatApiError(e));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleAttachmentPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files);
    if (editingQuestion) {
      for (const file of picked) {
        await uploadAttachment(editingQuestion.id, file);
      }
    } else {
      setPendingFiles((prev) => [...prev, ...picked]);
    }
  };

  const saveQuestion = () => {
    saveQuestionMutation.mutate({
      draft: questionDraft,
      editing: editingQuestion,
      pending: pendingFiles,
    });
  };

  const removeQuestion = async (q: Question) => {
    const confirmed = await confirm({
      title: `Delete question ${q.order}?`,
      description: "This permanently removes the question and its attachments.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    deleteQuestionMutation.mutate(q.id);
  };

  const reorderQuestionsByIds = (questionIds: number[]) => {
    reorderMutation.mutate(questionIds);
  };

  const handleImportFile = async (file: File) => {
    setActionError(null);
    setImportErrors([]);
    try {
      const text = await readImportFileAsCsv(file);
      setImportCsv(text);
      setMessage(`Loaded "${file.name}". Review the rows below, then import.`);
    } catch (e: unknown) {
      setActionError(
        e instanceof Error
          ? e.message
          : "Could not read that file. Upload the worksheet (.xlsx) or a .csv file."
      );
    }
  };

  const runImport = () => {
    setImportErrors([]);
    if (!importCsv.trim()) {
      setImportErrors(["Add at least one question row, or download the template to get started."]);
      return;
    }
    importQuestionsMutation.mutate(importCsv);
  };

  const publish = () => publishMutation.mutate();

  const addCandidate = () => {
    if (!candidateEmail.trim()) return;
    addCandidateMutation.mutate(candidateEmail.trim());
  };

  const importCandidates = () => importCandidatesMutation.mutate(candidateCsv);

  const addSection = async () => {
    const title = window.prompt("Section title?");
    if (!title?.trim()) return;
    createSectionMutation.mutate(title.trim());
  };

  return {
    tab,
    setTab,
    exam,
    form,
    setForm,
    questions,
    readiness,
    assignments,
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
    setShowQuestionForm,
    editingQuestion,
    questionDraft,
    setQuestionDraft,
    questionAttachments,
    pendingFiles,
    setPendingFiles,
    attachmentBusy,
    openNewQuestion,
    openEditQuestion,
    handleAttachmentPick,
    removeAttachment,
    saveQuestion,
    removeQuestion,
    reorderQuestionsByIds,
    importCsv,
    setImportCsv,
    importErrors,
    importBusy: importQuestionsMutation.isPending,
    handleImportFile,
    runImport,
    publish,
    candidateEmail,
    setCandidateEmail,
    candidateCsv,
    setCandidateCsv,
    addCandidate,
    importCandidates,
    addSection,
    createSectionPending: createSectionMutation.isPending,
    addCandidatePending: addCandidateMutation.isPending,
    importCandidatesPending: importCandidatesMutation.isPending,
  };
}
