import { signOut } from "../(auth)/actions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "—";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            ФОП Документи
          </span>
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
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
