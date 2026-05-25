"use client";

import { useActionState } from "react";

import type { PatternEntry } from "@/lib/settings";

import { initialPatternActionState } from "./action-state";
import { removePattern } from "./actions";

function RemoveButton({ index }: { index: number }) {
  const [state, formAction] = useActionState(removePattern, initialPatternActionState);
  return (
    <td className="px-4 py-3 text-right">
      <form action={formAction} className="inline">
        <input type="hidden" name="index" value={index} />
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

export function PatternList({ patterns }: { patterns: PatternEntry[] }) {
  if (patterns.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Немає патернів</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Regex</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Опис</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              <span className="sr-only">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((p, i) => (
            <tr key={`${p.pattern}-${String(i)}`} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono text-xs">{p.pattern}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.description || "—"}</td>
              <RemoveButton index={i} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
