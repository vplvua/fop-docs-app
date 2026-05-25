"use client";

import { useActionState } from "react";

import type { Tariff } from "@/lib/db/schema/tariffs";

import { initialTariffActionState } from "./action-state";
import { deleteTariff } from "./actions";

function DeleteCell({ tariffId }: { tariffId: string }) {
  const [state, formAction] = useActionState(deleteTariff, initialTariffActionState);
  return (
    <td className="px-4 py-3 text-right">
      <form action={formAction} className="inline">
        <input type="hidden" name="id" value={tariffId} />
        <button type="submit" className="text-sm text-destructive hover:underline">
          Видалити
        </button>
      </form>
      {state.status === "error" && state.message ? (
        <p className="mt-1 text-xs text-destructive">{state.message}</p>
      ) : null}
    </td>
  );
}

export function TariffTable({ tariffs }: { tariffs: Tariff[] }) {
  if (tariffs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Немає тарифів</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Від (кв.)</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">До (кв.)</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ціна, грн</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Діє з</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              <span className="sr-only">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tariffs.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{t.apartmentsMin}</td>
              <td className="px-4 py-3">{t.apartmentsMax ?? "∞"}</td>
              <td className="px-4 py-3">{t.price}</td>
              <td className="px-4 py-3">{t.effectiveFrom}</td>
              <DeleteCell tariffId={t.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
