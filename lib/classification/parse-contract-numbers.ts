import type { PatternEntry } from "@/lib/settings";

export function parseContractNumbers(purpose: string, patterns: PatternEntry[]): string[] {
  const matched = new Set<string>();

  for (const entry of patterns) {
    try {
      const regex = new RegExp(entry.pattern, "gi");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(purpose)) !== null) {
        const value = match[1] ?? match[0];
        const trimmed = value.trim();
        if (trimmed) {
          matched.add(trimmed);
        }
      }
    } catch {
      continue;
    }
  }

  return [...matched];
}
