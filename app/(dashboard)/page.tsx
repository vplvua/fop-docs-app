import { DubidocPollButton } from "./dubidoc-poll-button";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Дашборд</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Підключіть інтеграції. Повноцінний дашборд з health-banners і лічильниками з'явиться у
          Slice 13.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-foreground">Ручні дії</h2>
        <DubidocPollButton />
      </div>
    </section>
  );
}
