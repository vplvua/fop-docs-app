"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialServiceNameActionState } from "../service-name-state";
import { updateAnnualPaidMonths } from "./annual-discount-action";

const inputClass =
  "block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

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

export function AnnualDiscountForm({ defaultValue }: { defaultValue: number }) {
  const [state, formAction] = useActionState(updateAnnualPaidMonths, initialServiceNameActionState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="max-w-[12rem] space-y-1.5">
        <label htmlFor="annualPaidMonths" className="block text-sm font-medium text-foreground">
          Оплачених місяців за рік
        </label>
        <input
          id="annualPaidMonths"
          name="annualPaidMonths"
          type="number"
          min={1}
          step={1}
          defaultValue={defaultValue}
          aria-label="Оплачених місяців за рік"
          className={inputClass}
        />
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>

      {state.status === "success" && state.message ? (
        <p className="text-sm text-success-deep">{state.message}</p>
      ) : null}

      <SaveButton />
    </form>
  );
}
