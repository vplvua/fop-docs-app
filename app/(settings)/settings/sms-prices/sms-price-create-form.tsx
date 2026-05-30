"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialSmsPriceActionState } from "./action-state";
import { createSmsPrice } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Додавання…" : "Додати ціну"}
    </button>
  );
}

export function SmsPriceCreateForm() {
  const [state, formAction] = useActionState(createSmsPrice, initialSmsPriceActionState);
  const fe = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Нова ціна СМС</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="price" className="block text-sm font-medium text-foreground">
            Ціна, грн <span className="ml-0.5 text-destructive">*</span>
          </label>
          <input
            id="price"
            name="price"
            aria-label="Ціна, грн"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {fe?.price ? <p className="text-xs text-destructive">{fe.price}</p> : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="effectiveFrom" className="block text-sm font-medium text-foreground">
            Діє з <span className="ml-0.5 text-destructive">*</span>
          </label>
          <input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            aria-label="Діє з"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {fe?.effectiveFrom ? (
            <p className="text-xs text-destructive">{fe.effectiveFrom}</p>
          ) : null}
        </div>
      </div>
      {state.status === "success" && state.message ? (
        <p className="text-sm text-success-deep">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
