import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { buttonVariants } from "../ui/button";
import { cn } from "../ui/utils";

/** Options controlling the appearance and copy of a confirmation dialog. */
export interface ConfirmOptions {
  /** Heading shown at the top of the dialog. */
  title: string;
  /** Optional supporting text describing the consequence of confirming. */
  description?: string;
  /** Label for the confirm button (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Label for the cancel button (defaults to "Cancel"). */
  cancelLabel?: string;
  /**
   * When `true` the confirm button uses the destructive style. Use this for
   * irreversible actions such as deletes or session termination.
   */
  destructive?: boolean;
}

/** Async function that opens a confirmation dialog and resolves the user's choice. */
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  open: boolean;
}

const CLOSED_STATE: DialogState = { open: false, title: "" };

/**
 * Provides a promise-based confirmation dialog to the React tree.
 *
 * Mount this once near the application root. Descendant components call
 * {@link useConfirm} to await a user decision instead of using the native,
 * unstyled `window.confirm`. A single dialog instance is shared app-wide,
 * keeping confirmation UX consistent and DRY.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(CLOSED_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) settle(false);
    },
    [settle],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog open={state.open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description ? (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {state.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                state.destructive &&
                  buttonVariants({ variant: "destructive" }),
              )}
              onClick={() => settle(true)}
            >
              {state.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async `confirm` function backed by a shared {@link ConfirmProvider}.
 *
 * @returns A function that opens the confirmation dialog and resolves to `true`
 *   when the user confirms and `false` when they cancel or dismiss it.
 * @throws If called outside of a {@link ConfirmProvider}.
 *
 * @example
 * const confirm = useConfirm();
 * if (await confirm({ title: "Delete item?", destructive: true })) {
 *   await remove();
 * }
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a <ConfirmProvider>.");
  }
  return ctx;
}
