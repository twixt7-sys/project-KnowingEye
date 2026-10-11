import { useAuth } from "@/core/providers/auth-provider";

/**
 * Whether the signed-in user may preview a given exam. Mirrors the backend's
 * `assert_can_preview_exam`: reviewers (`exams.approve`) may preview any exam,
 * everyone else only exams they created. `can()` is true for admins.
 */
export function useCanPreviewExam(): (createdBy?: number | null) => boolean {
  const { user, can } = useAuth();
  return (createdBy) =>
    can("exams.approve") ||
    (can("exams.update") && createdBy != null && createdBy === user?.id);
}
