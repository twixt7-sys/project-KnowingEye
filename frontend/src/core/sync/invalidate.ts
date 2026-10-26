import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { adminKeys } from "@/features/admin/queries/keys";
import { authKeys } from "@/features/auth/queries/keys";
import { behaviorKeys } from "@/features/behavior/queries/keys";
import { dashboardKeys } from "@/features/dashboard/queries/keys";
import { examGraderKeys } from "@/features/exams/queries/grader-keys";
import { examBuilderKeys, examPreviewKeys } from "@/features/exams/queries/keys";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { profileKeys } from "@/features/profile/queries/keys";
import { reportsKeys } from "@/features/reports/queries/keys";
import { sessionKeys } from "@/features/session/queries/keys";
import type { DataChange } from "@/shared/lib/data-changes";

type Target = {
  queryKey: QueryKey;
  /**
   * "none" only marks the data stale, so it is refetched the next time a
   * screen opens it instead of under the user's feet.
   */
  refetchType?: "active" | "none";
};

// A preview in progress must never be refetched (it would reshuffle), so it
// is only marked stale.
const ALL_PREVIEWS: QueryKey = ["exam-preview"];

/**
 * Every cached query that can show data of the changed kind.
 *
 * This is the one place that knows which screens depend on what: when a new
 * query is added, add its key here under every topic it reads from.
 */
function targetsFor({ topic, examId }: DataChange): Target[] {
  const oneExam = examId != null;
  switch (topic) {
    case "exams":
      return [
        { queryKey: dashboardKeys.all },
        { queryKey: oneExam ? examBuilderKeys.detail(examId) : examBuilderKeys.all },
        {
          queryKey: oneExam ? examPreviewKeys.detail(examId) : ALL_PREVIEWS,
          refetchType: "none",
        },
        { queryKey: oneExam ? [...examGraderKeys.all, examId] : examGraderKeys.all },
        { queryKey: reportsKeys.all },
        { queryKey: monitoringKeys.activeSessions() },
      ];
    case "reference":
      return [
        { queryKey: dashboardKeys.all },
        { queryKey: adminKeys.departments() },
        { queryKey: reportsKeys.all },
      ];
    case "sessions":
      return [
        { queryKey: dashboardKeys.all },
        // Completed examinees, and whether questions are still editable.
        { queryKey: oneExam ? examBuilderKeys.detail(examId) : examBuilderKeys.all },
        { queryKey: oneExam ? [...examGraderKeys.all, examId] : examGraderKeys.all },
        { queryKey: reportsKeys.all },
        { queryKey: monitoringKeys.all },
        { queryKey: sessionKeys.all },
      ];
    case "alerts":
      return [
        { queryKey: monitoringKeys.all },
        { queryKey: behaviorKeys.all },
        { queryKey: reportsKeys.all },
      ];
    case "users":
      return [
        { queryKey: adminKeys.all },
        { queryKey: dashboardKeys.all },
        { queryKey: reportsKeys.all },
      ];
    case "me":
      return [{ queryKey: profileKeys.all }, { queryKey: authKeys.all }];
  }
}

/** Refresh everything on screen that shows any of `changes`. */
export async function invalidateForChanges(
  queryClient: QueryClient,
  changes: DataChange[],
): Promise<void> {
  const seen = new Set<string>();
  const work: Promise<void>[] = [];
  for (const change of changes) {
    for (const { queryKey, refetchType = "active" } of targetsFor(change)) {
      const id = `${JSON.stringify(queryKey)}|${refetchType}`;
      if (seen.has(id)) continue;
      seen.add(id);
      // A fetch already in flight may have started before the write, so it
      // is restarted (React Query's default) rather than reused.
      work.push(queryClient.invalidateQueries({ queryKey, refetchType }));
    }
  }
  await Promise.all(work);
}

/** After a gap in notifications (socket dropped), anything may have changed. */
export async function invalidateEverything(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== ALL_PREVIEWS[0],
    }),
    queryClient.invalidateQueries({ queryKey: ALL_PREVIEWS, refetchType: "none" }),
  ]);
}
