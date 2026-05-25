import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { smsPrices } from "@/lib/db/schema/tariffs";

import { SmsPriceCreateForm } from "./sms-price-create-form";
import { SmsPriceTable } from "./sms-price-table";

export const metadata = { title: "Ціни СМС · Налаштування · ФОП Документи" };

export default async function SmsPricesPage() {
  const rows = await db.select().from(smsPrices).orderBy(asc(smsPrices.effectiveFrom));
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Ціни СМС-розсилки</h2>
      <SmsPriceTable prices={rows} />
      <SmsPriceCreateForm />
    </div>
  );
}
