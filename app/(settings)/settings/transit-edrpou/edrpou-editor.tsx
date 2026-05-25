"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialListActionState } from "./action-state";
import { addEdrpou, removeEdrpou } from "./actions";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Додати
    </button>
  );
}

function RemoveChip({ value }: { value: string }) {
  const [, formAction] = useActionState(removeEdrpou, initialListActionState);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="value" value={value} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 font-mono text-sm text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        {value} <span aria-label={`Видалити ${value}`}>×</span>
      </button>
    </form>
  );
}

export function EdrpouEditor({ items }: { items: string[] }) {
  const [state, formAction] = useActionState(addEdrpou, initialListActionState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {items.map((e) => (
          <RemoveChip key={e} value={e} />
        ))}
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Немає ЄДРПОУ</p> : null}
      </div>
      <form action={formAction} className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="value" className="block text-sm font-medium text-foreground">
            ЄДРПОУ (8 цифр)
          </label>
          <input
            id="value"
            name="value"
            aria-label="ЄДРПОУ"
            pattern="\d{8}"
            maxLength={8}
            className="block h-9 w-48 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <AddButton />
      </form>
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
    </div>
  );
}
