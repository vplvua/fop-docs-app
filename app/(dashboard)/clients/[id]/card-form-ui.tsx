"use client";

/** Ukrainian plural for the "N полів" error summary. */
function pluralFields(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "поле";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "поля";
  return "полів";
}

/** Top-of-form alert summarising validation failures. */
export function FormErrorSummary({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      Виправте {count} {pluralFields(count)} нижче.
    </div>
  );
}

/** Sticky bar shown while a card form has unsaved changes. */
export function SaveBar({
  dirty,
  saving,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <span className="text-sm text-muted-foreground">Є незбережені зміни</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Збереження…" : "Зберегти"}
        </button>
      </div>
    </div>
  );
}
