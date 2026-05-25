import Link from "next/link";

import { TopBar } from "../../components/top-bar";

const SETTINGS_NAV = [
  { href: "/settings/tariffs", label: "Тарифи" },
  { href: "/settings/sms-prices", label: "Ціни СМС" },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
            Налаштування
          </h1>
          <div className="flex gap-8">
            <nav className="flex w-48 shrink-0 flex-col gap-1">
              {SETTINGS_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
