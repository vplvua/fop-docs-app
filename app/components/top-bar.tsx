import { count, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";

import { NavLinks, NavLinksFallback, type NavLink } from "./nav-links";
import { signOut } from "../(auth)/actions";

const NAV_LINKS: NavLink[] = [
  { href: "/clients", label: "Клієнти", remember: true },
  { href: "/payments", label: "Платежі", remember: true },
  { href: "/queue", label: "Черга" },
  { href: "/acts", label: "Акти", remember: true },
  { href: "/settings/tariffs", label: "Налаштування" },
];

async function getQueueCount(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(payments)
    .where(inArray(payments.status, ["awaiting_review", "in_queue"]));
  return row?.value ?? 0;
}

export async function TopBar() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "—";
  const queueCount = await getQueueCount();
  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            ФОП Документи
          </Link>
          {/* Suspense keeps statically prerendered pages (e.g. `/`) from bailing
              to CSR over `NavLinks`' `useSearchParams`; the fallback is the same
              nav without restored memory. */}
          {/* eslint-disable-next-line react-perf/jsx-no-jsx-as-prop -- Suspense fallback is an idiomatic element prop */}
          <Suspense fallback={<NavLinksFallback links={NAV_LINKS} queueCount={queueCount} />}>
            <NavLinks links={NAV_LINKS} queueCount={queueCount} />
          </Suspense>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" title={adminEmail}>
            {adminEmail}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Вийти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
