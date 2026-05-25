"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialIntegrationActionState } from "./action-state";
import { updateIntervals } from "./actions";

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

export function IntervalsForm({
  defaults,
}: {
  defaults: { privatbankMinutes: number; dubidocHours: number; moeosbbSchedule: string };
}) {
  const [state, formAction] = useActionState(updateIntervals, initialIntegrationActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="privatbankMinutes" className="block text-sm font-medium text-foreground">
            ПриватБанк (хв.)
          </label>
          <input
            id="privatbankMinutes"
            name="privatbankMinutes"
            type="number"
            min={1}
            defaultValue={defaults.privatbankMinutes}
            aria-label="Інтервал ПриватБанку в хвилинах"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="dubidocHours" className="block text-sm font-medium text-foreground">
            Дубідок (год.)
          </label>
          <input
            id="dubidocHours"
            name="dubidocHours"
            type="number"
            min={1}
            defaultValue={defaults.dubidocHours}
            aria-label="Інтервал Дубідок в годинах"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="moeosbbSchedule" className="block text-sm font-medium text-foreground">
            Моє ОСББ sync
          </label>
          <select
            id="moeosbbSchedule"
            name="moeosbbSchedule"
            defaultValue={defaults.moeosbbSchedule}
            aria-label="Розклад sync Моє ОСББ"
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="first">1-го числа місяця</option>
            <option value="last">Останній день місяця</option>
            <option value="manual">Тільки вручну</option>
          </select>
        </div>
      </div>
      {state.status === "success" && state.message ? (
        <p className="text-sm text-green-700">{state.message}</p>
      ) : null}
      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <SaveButton />
    </form>
  );
}
