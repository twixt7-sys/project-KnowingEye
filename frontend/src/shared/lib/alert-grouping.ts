/**
 * Groups repeated alerts (e.g. "looking_away" fired 12 times) into a single
 * collapsible entry so lists can be displayed and resolved in bulk instead
 * of one row per occurrence.
 */

export type AlertSeverity = "low" | "medium" | "high";

const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export interface AlertGroup<T> {
  key: string;
  alertType: string;
  severity: AlertSeverity;
  message: string;
  count: number;
  latestAt: string | null;
  /** All items in the group, newest first. */
  items: T[];
  /** ids of items that are still unresolved (undefined `resolved` counts as unresolved). */
  unresolvedIds: string[];
}

export interface GroupAlertsOptions<T> {
  keyOf: (item: T) => string;
  typeOf: (item: T) => string;
  severityOf: (item: T) => string;
  messageOf: (item: T) => string;
  timeOf: (item: T) => string | null | undefined;
  idOf?: (item: T) => string | undefined;
  resolvedOf?: (item: T) => boolean | undefined;
}

function toSeverity(value: string): AlertSeverity {
  return value === "high" || value === "low" ? value : "medium";
}

export function groupAlerts<T>(items: T[], opts: GroupAlertsOptions<T>): AlertGroup<T>[] {
  const groups = new Map<string, AlertGroup<T>>();

  for (const item of items) {
    const key = opts.keyOf(item);
    const time = opts.timeOf(item) ?? null;
    const id = opts.idOf?.(item);
    const resolved = opts.resolvedOf?.(item) ?? false;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        alertType: opts.typeOf(item),
        severity: toSeverity(opts.severityOf(item)),
        message: opts.messageOf(item),
        count: 0,
        latestAt: time,
        items: [],
        unresolvedIds: [],
      };
      groups.set(key, group);
    }

    group.count += 1;
    group.items.push(item);
    if (id && !resolved) group.unresolvedIds.push(id);

    const itemSeverity = toSeverity(opts.severityOf(item));
    if (SEVERITY_RANK[itemSeverity] > SEVERITY_RANK[group.severity]) {
      group.severity = itemSeverity;
    }

    if (time && (!group.latestAt || time > group.latestAt)) {
      group.latestAt = time;
      group.message = opts.messageOf(item);
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return (b.latestAt ?? "").localeCompare(a.latestAt ?? "");
  });
}
