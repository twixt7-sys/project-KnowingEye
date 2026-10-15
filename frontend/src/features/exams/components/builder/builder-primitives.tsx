import type { ReactNode } from "react";
import { FileAudio, FileImage, FileText } from "@/shared/icons";

import type { QuestionAttachment } from "@/core/config/api";
import { Checkbox } from "@/shared/components/ui/checkbox";

export function CheckboxSetting({
  checked,
  onCheckedChange,
  disabled = false,
  title,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground mt-1">{description}</span>
        </span>
      </label>
    </div>
  );
}

interface DepartmentChecklistProps {
  departments: { id: number; name: string; abbreviation: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
  /** Home department: always shown checked and can't be unchecked or cleared. */
  lockedId?: number | null;
  disabled?: boolean;
}

/** Multi-select of departments an exam is visible to, with a Select all / Clear all shortcut. */
export function DepartmentChecklist({
  departments,
  value,
  onChange,
  lockedId = null,
  disabled = false,
}: DepartmentChecklistProps) {
  const selected = new Set(value);
  if (lockedId != null) selected.add(lockedId);
  const allSelected = departments.length > 0 && departments.every((d) => selected.has(d.id));

  const toggle = (id: number) => {
    if (id === lockedId) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const toggleAll = () =>
    onChange(allSelected ? (lockedId != null ? [lockedId] : []) : departments.map((d) => d.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {departments.map((d) => {
          const checked = selected.has(d.id);
          const locked = d.id === lockedId;
          return (
            <label
              key={d.id}
              title={d.name}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                disabled || locked ? "cursor-default" : "cursor-pointer"
              } ${
                checked
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(d.id)}
                disabled={disabled || locked}
                className="h-3.5 w-3.5"
              />
              {d.abbreviation}
            </label>
          );
        })}
      </div>
      {departments.length > 1 && (
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      )}
    </div>
  );
}

export function BuilderField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function BuilderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function BuilderIconBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="p-1.5 rounded border border-border hover:bg-accent"
    >
      {children}
    </button>
  );
}

export function AttachmentIcon({ kind }: { kind: QuestionAttachment["kind"] }) {
  if (kind === "image") return <FileImage className="w-4 h-4 text-muted-foreground" />;
  if (kind === "audio") return <FileAudio className="w-4 h-4 text-muted-foreground" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}
