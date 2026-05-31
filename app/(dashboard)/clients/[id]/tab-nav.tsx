"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { key: "info", label: "Загальна інформація" },
  { key: "contract", label: "Договір" },
  { key: "payments", label: "Платежі" },
  { key: "acts", label: "Акти" },
] as const;

/**
 * Card tab navigation. Each link preserves the current search params (only
 * swapping `tab`), so the per-tab date filters (`p_*` / `a_*`) survive tab
 * switches and stay independent of one another.
 */
export function TabNav({ clientId, active }: { clientId: string; active: string }) {
  const searchParams = useSearchParams();

  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", t.key);
        return (
          <Link
            key={t.key}
            href={`/clients/${clientId}?${params.toString()}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
