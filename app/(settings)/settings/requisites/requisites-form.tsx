"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { FopRequisites } from "@/lib/requisites";

import { initialRequisitesActionState } from "./action-state";
import { updateRequisites } from "./actions";

interface FieldSpec {
  name: keyof FopRequisites;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

const FIELDS: FieldSpec[] = [
  {
    name: "nameNominative",
    label: "Назва Виконавця (для реквізитів, як у шапці)",
    multiline: true,
    placeholder: "ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ ...",
  },
  {
    name: "nameGenitive",
    label: "Назва у родовому відмінку (для преамбули)",
    multiline: true,
    placeholder: "фізичної особи-підприємця ...",
  },
  { name: "ipn", label: "ІПН" },
  { name: "legalAddress", label: "Юридична адреса", multiline: true },
  { name: "bankAccount", label: "Поточний рахунок (IBAN)" },
  { name: "bankName", label: "Банк" },
  { name: "taxNote", label: "Податковий статус" },
  { name: "phone", label: "Телефон" },
  { name: "email", label: "Електронна адреса" },
  { name: "city", label: "Місце складання (рядок шапки акта)", placeholder: "м. Львів" },
];

const inputClass =
  "block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";
const textareaClass =
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

function Field({
  field,
  defaultValue,
  error,
}: {
  field: FieldSpec;
  defaultValue: string;
  error: string | undefined;
}) {
  return (
    <div className={field.multiline ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <label htmlFor={field.name} className="block text-sm font-medium text-foreground">
        {field.label}
      </label>
      {field.multiline ? (
        <textarea
          id={field.name}
          name={field.name}
          rows={2}
          defaultValue={defaultValue}
          placeholder={field.placeholder}
          aria-label={field.label}
          className={textareaClass}
        />
      ) : (
        <input
          id={field.name}
          name={field.name}
          type="text"
          defaultValue={defaultValue}
          placeholder={field.placeholder}
          aria-label={field.label}
          className={inputClass}
        />
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function RequisitesForm({ defaults }: { defaults: FopRequisites | null }) {
  const [state, formAction] = useActionState(updateRequisites, initialRequisitesActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Field
            key={field.name}
            field={field}
            defaultValue={defaults?.[field.name] ?? ""}
            error={state.fieldErrors?.[field.name]}
          />
        ))}
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
