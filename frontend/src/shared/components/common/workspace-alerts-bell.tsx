import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, Loader2 } from "lucide-react";
import { apiClient, type AlertRow } from "../../../core/config/api";
import { cn } from "../ui/utils";

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

export function WorkspaceAlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await apiClient.listAlerts({ resolved: false });
      setAlerts(rows.slice(0, 12));
    } catch {
      /* silent — bell is non-blocking */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const count = alerts.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-form-field text-foreground transition-colors hover:bg-form-field-hover"
        aria-label={`Notifications${count ? `, ${count} unresolved` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Alerts</p>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {alerts.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No unresolved alerts.
              </p>
            )}
            {alerts.map((alert) => (
              <div key={alert.id} className="px-4 py-3 hover:bg-accent/40">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      SEVERITY_DOT[alert.severity] ?? "bg-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {alert.session_user ?? "Examinee"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{alert.exam_title}</p>
                    <p className="text-xs">{alert.alert_type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-2">
            <Link
              to="/monitoring"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
            >
              Open monitoring
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
