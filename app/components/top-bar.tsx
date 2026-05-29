import { count, inArray } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";

import { signOut } from "../(auth)/actions";

const NAV_LINKS = [
  { href: "/clients", label: "Клієнти" },
  { href: "/payments", label: "Платежі" },
  { href: "/queue", label: "Черга" },
  { href: "/acts", label: "Акти" },
  { href: "/settings/tariffs", label: "Налаштування" },
] as const;

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
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            ФОП Документи
          </Link>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
                {link.href === "/queue" && queueCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {queueCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
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
