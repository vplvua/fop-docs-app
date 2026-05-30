"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialTariffActionState } from "./action-state";
import { createTariff } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Додавання…" : "Додати тариф"}
    </button>
  );
}

export function TariffCreateForm() {
  const [state, formAction] = useActionState(createTariff, initialTariffActionState);
  const fe = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Новий тариф</h3>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field
          id="apartmentsMin"
          label="Від (кв.)"
          type="number"
          defaultValue="0"
          error={fe?.apartmentsMin}
        />
        <Field
          id="apartmentsMax"
          label="До (кв.)"
          type="number"
          hint="Пусто = базове"
          error={fe?.apartmentsMax}
        />
        <Field id="price" label="Ціна, грн" defaultValue="" error={fe?.price} required />
        <Field id="effectiveFrom" label="Діє з" type="date" error={fe?.effectiveFrom} required />
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

function Field({
  id,
  label,
  type = "text",
  defaultValue,
  error,
  hint,
  required,
}: {
  id: string;
  label: string;
  type?: string | undefined;
  defaultValue?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue ?? ""}
        aria-label={label}
        className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
