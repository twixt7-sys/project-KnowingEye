import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { type AlertRow, formatApiError } from "@/core/config/api";
import { resolveAlertsBulk } from "@/features/monitoring/api/monitoring-api";
import { SEVERITY_COLORS } from "@/features/monitoring/components/live-alert-feed";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { groupAlerts } from "@/shared/lib/alert-grouping";

type UnresolvedAlertsPanelProps = {
  alerts: AlertRow[];
  loading: boolean;
  description?: string;
  onError: (message: string) => void;
};

/** Unresolved alerts grouped by session and type, with a one-click resolve per group. */
export function UnresolvedAlertsPanel({
  alerts,
  loading,
  description = "Grouped by session and type; resolve a group once reviewed.",
  onError,
}: UnresolvedAlertsPanelProps) {
  const queryClient = useQueryClient();
  const [resolvingGroup, setResolvingGroup] = useState<string | null>(null);

  const alertGroups = useMemo(
    () =>
      groupAlerts(alerts, {
        keyOf: (a) => `${a.session}:${a.alert_type}`,
        typeOf: (a) => a.alert_type,
        severityOf: (a) => a.severity,
        messageOf: (a) => a.message,
        timeOf: (a) => a.created_at,
        idOf: (a) => a.id,
        resolvedOf: (a) => a.resolved,
      }),
    [alerts]
  );

  const handleResolveGroup = async (session: string, alertType: string, groupKey: string) => {
    setResolvingGroup(groupKey);
    try {
      await resolveAlertsBulk({ session, alert_type: alertType });
      queryClient.setQueryData<AlertRow[]>(
        monitoringKeys.alerts({ resolved: false }),
        (prev) => prev?.filter((a) => !(a.session === session && a.alert_type === alertType)) ?? []
      );
    } catch (e: unknown) {
      onError(formatApiError(e, "Failed to resolve alerts"));
    } finally {
      setResolvingGroup(null);
    }
  };

  return (
    <SectionPanel title="Unresolved alerts" description={description}>
      <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
        {alertGroups.length === 0 && !loading && (
          <div className="p-10 text-center text-sm text-muted-foreground">No active alerts.</div>
        )}
        {alertGroups.map((g) => {
          const first = g.items[0];
          return (
            <div key={g.key} className="p-4">
              <div className="mb-1 flex items-start justify-between gap-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    SEVERITY_COLORS[g.severity] ?? ""
                  }`}
                >
                  {g.severity}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {g.latestAt ? new Date(g.latestAt).toLocaleTimeString() : ""}
                </span>
              </div>
              <p className="text-sm font-medium">
                {g.alertType}
                {g.count > 1 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    ×{g.count}
                  </span>
                )}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">{g.message}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{first.session_user}</span>
                <button
                  type="button"
                  disabled={resolvingGroup === g.key}
                  onClick={() => void handleResolveGroup(first.session, g.alertType, g.key)}
                  className="rounded-md bg-status-safe/10 px-2 py-1 text-status-safe hover:bg-status-safe/20 disabled:opacity-50"
                >
                  {g.count > 1 ? `Resolve all (${g.count})` : "Resolve"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
