"use client";

interface Props {
  id: string;
  label: string;
  type?: "text" | "email" | "number";
  defaultValue?: string | number | null | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  hint?: string | undefined;
}

export function ClientField({
  id,
  label,
  type = "text",
  defaultValue,
  error,
  required,
  hint,
}: Props) {
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
        name={id}
        type={type}
        defaultValue={defaultValue ?? ""}
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
