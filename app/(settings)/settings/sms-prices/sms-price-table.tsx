"use client";

import { useActionState } from "react";

import type { SmsPrice } from "@/lib/db/schema/tariffs";

import { initialSmsPriceActionState } from "./action-state";
import { deleteSmsPrice } from "./actions";

function DeleteCell({ priceId }: { priceId: string }) {
  const [state, formAction] = useActionState(deleteSmsPrice, initialSmsPriceActionState);
  return (
    <td className="px-4 py-3 text-right">
      <form action={formAction} className="inline">
        <input type="hidden" name="id" value={priceId} />
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

export function SmsPriceTable({ prices }: { prices: SmsPrice[] }) {
  if (prices.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Немає цін СМС</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ціна, грн</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Діє з</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              <span className="sr-only">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prices.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{p.price}</td>
              <td className="px-4 py-3">{p.effectiveFrom}</td>
              <DeleteCell priceId={p.id} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
