/** Always-visible notice that an examiner is previewing the exam: nothing is saved or submitted. */
export function PreviewBanner({ onExit }: { onExit?: () => void }) {
  return (
    <output className="block border-b border-status-watch/30 bg-status-watch/10 text-status-watch">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium">
        <span>Preview mode - nothing is saved</span>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-current/30 px-3 py-1 hover:bg-status-watch/10"
        >
          Exit preview
        </button>
      </div>
    </output>
  );
}
