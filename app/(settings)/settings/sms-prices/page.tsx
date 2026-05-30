import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { smsPrices } from "@/lib/db/schema/tariffs";
import { getServiceNames } from "@/lib/services";

import { ServiceNameForm } from "../service-name-form";
import { updateSmsServiceName } from "./service-name-action";
import { SmsPriceCreateForm } from "./sms-price-create-form";
import { SmsPriceTable } from "./sms-price-table";

export const metadata = { title: "Ціни СМС · Налаштування · ФОП Документи" };

export default async function SmsPricesPage() {
  const [rows, serviceNames] = await Promise.all([
    db.select().from(smsPrices).orderBy(asc(smsPrices.effectiveFrom)),
    getServiceNames(),
  ]);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Ціни СМС-розсилки</h2>
      <SmsPriceTable prices={rows} />
      <SmsPriceCreateForm />

      <div className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-base font-semibold text-foreground">
          Назва послуги (інтернет-розсилка)
        </h3>
        <p className="text-sm text-muted-foreground">
          Рядок послуги, що друкується на актах за СМС/інтернет-розсилку. Зміна застосовується до
          нових актів одразу; для вже виданих — перезапустіть «Перегенерувати всі акти».
        </p>
        <ServiceNameForm
          action={updateSmsServiceName}
          label="Назва послуги (інтернет-розсилка)"
          defaultValue={serviceNames.sms}
        />
      </div>
    </div>
  );
}
