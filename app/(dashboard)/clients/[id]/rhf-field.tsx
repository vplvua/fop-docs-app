"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

interface Props {
  id: string;
  label: string;
  type?: "text" | "email" | "number" | "date";
  registration: UseFormRegisterReturn;
  error?: string | undefined;
  required?: boolean | undefined;
  hint?: string | undefined;
}

/**
 * Controlled (react-hook-form) field for the client card. Unlike the uncontrolled
 * `ClientField`, the value lives in RHF state, so a failed submit never resets it.
 * The visual contract (label, required asterisk, hint, invalid border, error text,
 * aria wiring) matches `ClientField`.
 */
export function RhfField({ id, label, type = "text", registration, error, required, hint }: Props) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <label id={labelId} htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        {...registration}
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`block h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
