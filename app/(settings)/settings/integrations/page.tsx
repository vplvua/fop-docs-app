import { getPollingIntervals } from "@/lib/settings";

import { IntervalsForm } from "./intervals-form";

export const metadata = { title: "Інтеграції · Налаштування · ФОП Документи" };

const INTEGRATIONS = [
  { name: "ПриватБанк", description: "Polling платежів через Автоклієнт API" },
  { name: "Дубідок", description: "Відправка актів та polling статусів" },
  { name: "Моє ОСББ", description: "Sync реквізитів клієнтів з MySQL" },
] as const;

export default async function IntegrationsPage() {
  const intervals = await getPollingIntervals();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Інтеграції</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <div key={i.name} className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">{i.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                Не налаштовано
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-4 text-sm font-medium text-foreground">Інтервали polling / sync</h3>
        <IntervalsForm defaults={intervals} />
      </div>

      <p className="text-xs text-muted-foreground">
        Токени та credentials налаштовуються через Vercel Environment Variables і не відображаються
        тут.
      </p>
    </div>
  );
}
