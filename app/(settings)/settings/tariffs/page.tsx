import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { tariffs } from "@/lib/db/schema/tariffs";

import { TariffCreateForm } from "./tariff-create-form";
import { TariffTable } from "./tariff-table";

export const metadata = { title: "Тарифи · Налаштування · ФОП Документи" };

export default async function TariffsPage() {
  const rows = await db.select().from(tariffs).orderBy(asc(tariffs.effectiveFrom));
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Тарифна сітка</h2>
      <TariffTable tariffs={rows} />
      <TariffCreateForm />
    </div>
  );
}
