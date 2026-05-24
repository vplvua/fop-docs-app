"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn } from "../actions";
import { initialSignInState, type SignInState } from "../sign-in-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Зачекайте…" : "Увійти"}
    </button>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  error?: string | undefined;
}

function Field({ id, label, type, autoComplete, error }: FieldProps) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label id={labelId} htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormAlert({ state }: { state: SignInState }) {
  if (
    state.status !== "invalid_credentials" &&
    state.status !== "rate_limited" &&
    state.status !== "config_error"
  ) {
    return null;
  }
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {state.message}
    </div>
  );
}

export function LoginForm({ next }: { next?: string | undefined }) {
  const [state, formAction] = useActionState(signIn, initialSignInState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="username"
        error={state.fieldErrors?.email}
      />
      <Field
        id="password"
        label="Пароль"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <FormAlert state={state} />
      <SubmitButton />
    </form>
  );
}
