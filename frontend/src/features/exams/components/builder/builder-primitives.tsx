import type { ReactNode } from "react";
import { FileAudio, FileImage, FileText } from "lucide-react";

import type { QuestionAttachment } from "@/core/config/api";

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
