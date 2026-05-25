"use client";

import { type ChangeEvent, useCallback, useState } from "react";

import type { PatternEntry } from "@/lib/settings";

interface MatchResult {
  index: number;
  pattern: string;
  groups: string[];
}

function runTests(patterns: PatternEntry[], input: string): MatchResult[] {
  if (!input) return [];
  const results: MatchResult[] = [];
  for (const [i, entry] of patterns.entries()) {
    try {
      const re = new RegExp(entry.pattern, "iu");
      const match = re.exec(input);
      if (match) {
        results.push({ index: i, pattern: entry.pattern, groups: match.slice(1) });
      }
    } catch {
      /* skip invalid */
    }
  }
  return results;
}

function MatchResultCard({ result }: { result: MatchResult }) {
  return (
    <div className="rounded-md border border-green-300/50 bg-green-50 p-2 text-sm dark:border-green-700/50 dark:bg-green-950/30">
      <p className="font-mono text-xs text-green-800 dark:text-green-200">
        #{String(result.index + 1)}: {result.pattern}
      </p>
      {result.groups.length > 0 ? (
        <p className="mt-1 text-green-700 dark:text-green-300">
          Захоплені групи:{" "}
          {result.groups.map((g, gi) => (
            <code
              key={`group-${String(gi)}`}
              className="mx-1 rounded bg-green-100 px-1 dark:bg-green-900"
            >
              {g}
            </code>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function PatternTestArea({ patterns }: { patterns: PatternEntry[] }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInput(value);
      setResults(runTests(patterns, value));
    },
    [patterns],
  );

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Тест-область</h3>
      <div className="space-y-1.5">
        <label htmlFor="testInput" className="block text-sm text-muted-foreground">
          Введіть приклад призначення платежу
        </label>
        <input
          id="testInput"
          type="text"
          value={input}
          aria-label="Тестовий рядок"
          onChange={handleChange}
          placeholder="Оплата по договір №556770"
          className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {input && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Жоден патерн не спрацював</p>
      ) : null}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r) => (
            <MatchResultCard key={r.index} result={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
