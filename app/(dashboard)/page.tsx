import { count, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { payments } from "@/lib/db/schema/payments";
import { DASHBOARD_INTEGRATIONS, deriveHealth, type DerivedHealth } from "@/lib/dashboard/health";
import { getIntegrationHealth } from "@/lib/observability";

import { DubidocPollButton } from "./dubidoc-poll-button";
import { MoeosbbSyncButton } from "./moeosbb-sync-button";
import { PrivatbankPollButton } from "./privatbank-poll-button";

export const metadata = { title: "Дашборд · ФОП Документи" };

async function countPaymentsByStatus(
  status: (typeof payments.status.enumValues)[number],
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(payments)
    .where(eq(payments.status, status));
  return row?.value ?? 0;
}

async function countActsByStatus(status: (typeof acts.status.enumValues)[number]): Promise<number> {
  const [row] = await db.select({ value: count() }).from(acts).where(eq(acts.status, status));
  return row?.value ?? 0;
}

export default async function DashboardPage() {
  const [health, queued, awaitingReview, awaitingSignature] = await Promise.all([
    getIntegrationHealth(),
    countPaymentsByStatus("in_queue"),
    countPaymentsByStatus("awaiting_review"),
    countActsByStatus("sent_to_edo"),
  ]);

  const healthByService = new Map(health.map((h) => [h.service, h]));

  return (
    <section className="space-y-8">
      <h1 className="text-heading-2 text-foreground">Дашборд</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {DASHBOARD_INTEGRATIONS.map((integration) => (
          <HealthBanner
            key={integration.service}
            name={integration.name}
            health={deriveHealth(healthByService.get(integration.service))}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CounterCard label="Платежів у черзі" value={queued} href="/queue?tab=in_queue" />
        <CounterCard
          label="Платежів на апрув"
          value={awaitingReview}
          href="/queue?tab=awaiting_review"
        />
        <CounterCard
          label="Актів очікують підпису"
          value={awaitingSignature}
          href="/acts?status=sent_to_edo"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-foreground">Ручні дії</h2>
        <div className="space-y-3">
          <PrivatbankPollButton />
          <MoeosbbSyncButton />
          <DubidocPollButton />
        </div>
      </div>
    </section>
  );
}

const BANNER_STYLES: Record<DerivedHealth["state"], string> = {
  ok: "border-success/30 bg-success/5",
  error: "border-destructive/30 bg-destructive/10",
  unknown: "border-border bg-muted/30",
};

const STATE_LABELS: Record<DerivedHealth["state"], string> = {
  ok: "✓ Працює",
  error: "✗ Помилка",
  unknown: "Ще не запускалось",
};

const STATE_COLORS: Record<DerivedHealth["state"], string> = {
  ok: "text-success-deep",
  error: "text-destructive-deep",
  unknown: "text-muted-foreground",
};

function fmt(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" });
}

function HealthBanner({ name, health }: { name: string; health: DerivedHealth }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${BANNER_STYLES[health.state]}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{name}</h3>
        <span className={`text-xs font-medium ${STATE_COLORS[health.state]}`}>
          {STATE_LABELS[health.state]}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Останній успіх: {fmt(health.lastSuccessAt)}
      </p>
      {health.state === "error" ? (
        <p className="mt-1 text-xs text-destructive-deep">
          {health.lastErrorMessage ?? "Помилка"} · {fmt(health.lastErrorAt)}
        </p>
      ) : null}
    </div>
  );
}

function CounterCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:bg-muted"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </Link>
  );
}
