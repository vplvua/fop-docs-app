"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialPatternActionState } from "./action-state";
import { addPattern } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Додавання…" : "Додати патерн"}
    </button>
  );
}

export function PatternCreateForm() {
  const [state, formAction] = useActionState(addPattern, initialPatternActionState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Новий патерн</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="pattern" className="block text-sm font-medium text-foreground">
            Regex <span className="ml-0.5 text-destructive">*</span>
          </label>
          <input
            id="pattern"
            name="pattern"
            aria-label="Regex"
            placeholder="договір\s*[№#]\s*(\d{5,6})"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Опис
          </label>
          <input
            id="description"
            name="description"
            aria-label="Опис"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {state.status === "success" && state.message ? (
        <p className="text-sm text-green-700">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
