"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** A registered editable form the guard can drive when the operator chooses "Зберегти". */
export interface GuardedFormHandle {
  /** Submit the form; resolves true on a successful save, false on validation/server error. */
  submit: () => Promise<boolean>;
  /** Revert the form to its loaded values. */
  reset: () => void;
}

interface UnsavedChangesApi {
  /** The active form reports its dirty state here. */
  setDirty: (dirty: boolean) => void;
  /** The active form registers (and unregisters) its submit/reset handle here. */
  registerHandle: (handle: GuardedFormHandle | null) => void;
  /** Run `proceed`, or prompt first if there are unsaved changes. */
  guard: (proceed: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

/** Access the guard from an editable form (info / contract). */
export function useUnsavedChanges(): UnsavedChangesApi {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error("useUnsavedChanges must be used within <UnsavedChangesProvider>");
  return ctx;
}

function guardableHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a");
  if (!anchor) return null;
  const href = anchor.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  return href;
}

/** Wires the browser-unload and in-app anchor-click guards while the form is dirty. */
function useLeaveGuards(dirty: boolean, guard: (proceed: () => void) => void) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const href = guardableHref(e.target);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      guard(() => router.push(href));
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, guard, router]);
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyRef = useRef(false);
  const handleRef = useRef<GuardedFormHandle | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirtyState(next);
  }, []);

  const registerHandle = useCallback((handle: GuardedFormHandle | null) => {
    handleRef.current = handle;
  }, []);

  const guard = useCallback((proceed: () => void) => {
    if (!dirtyRef.current) {
      proceed();
      return;
    }
    setPending(() => proceed);
  }, []);

  useLeaveGuards(dirty, guard);

  const closeDialog = useCallback(() => setPending(null), []);

  const onSave = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return closeDialog();
    setSaving(true);
    const ok = await handle.submit();
    setSaving(false);
    if (!ok) return closeDialog(); // keep the operator on the form to fix inline errors
    const proceed = pending;
    setPending(null);
    setDirty(false);
    proceed?.();
  }, [pending, closeDialog, setDirty]);

  const onDiscard = useCallback(() => {
    const proceed = pending;
    setPending(null);
    setDirty(false);
    handleRef.current?.reset();
    proceed?.();
  }, [pending, setDirty]);

  const api = useMemo<UnsavedChangesApi>(
    () => ({ setDirty, registerHandle, guard }),
    [setDirty, registerHandle, guard],
  );

  return (
    <UnsavedChangesContext.Provider value={api}>
      {children}
      {pending ? (
        <UnsavedChangesDialog
          saving={saving}
          onSave={onSave}
          onDiscard={onDiscard}
          onCancel={closeDialog}
        />
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

function UnsavedChangesDialog({
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <dialog
        open
        aria-labelledby="unsaved-changes-title"
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 text-foreground shadow-lg"
      >
        <h2 id="unsaved-changes-title" className="text-sm font-semibold text-foreground">
          Внесено зміни.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          У вас є незбережені зміни. Зберегти їх перед переходом?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            Відхилити
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
