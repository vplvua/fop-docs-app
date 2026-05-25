import Link from "next/link";

import { signOut } from "../(auth)/actions";

const NAV_LINKS = [
  { href: "/clients", label: "Клієнти" },
  { href: "/payments", label: "Платежі" },
  { href: "/settings/tariffs", label: "Налаштування" },
] as const;

export function TopBar() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "—";
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
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
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
