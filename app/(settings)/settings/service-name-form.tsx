"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialServiceNameActionState, type ServiceNameActionState } from "./service-name-state";

type Action = (prev: ServiceNameActionState, formData: FormData) => Promise<ServiceNameActionState>;

const inputClass =
  "block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Збереження…" : "Зберегти"}
    </button>
  );
}

export function ServiceNameForm({
  action,
  label,
  hint,
  defaultValue,
}: {
  action: Action;
  label: string;
  hint?: string;
  defaultValue: string;
}) {
  const [state, formAction] = useActionState(action, initialServiceNameActionState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="serviceName" className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <textarea
          id="serviceName"
          name="serviceName"
          rows={2}
          defaultValue={defaultValue}
          aria-label={label}
          className={inputClass}
        />
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>

      {state.status === "success" && state.message ? (
        <p className="text-sm text-success-deep">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      <SaveButton />
    </form>
  );
}
