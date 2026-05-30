import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { tariffs } from "@/lib/db/schema/tariffs";
import { getServiceNames } from "@/lib/services";

import { ServiceNameForm } from "../service-name-form";
import { updateAccessServiceName } from "./service-name-action";
import { TariffCreateForm } from "./tariff-create-form";
import { TariffTable } from "./tariff-table";

export const metadata = { title: "Тарифи · Налаштування · ФОП Документи" };

export default async function TariffsPage() {
  const [rows, serviceNames] = await Promise.all([
    db.select().from(tariffs).orderBy(asc(tariffs.effectiveFrom)),
    getServiceNames(),
  ]);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Тарифна сітка</h2>
      <TariffTable tariffs={rows} />
      <TariffCreateForm />

      <div className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-base font-semibold text-foreground">Назва послуги (доступ)</h3>
        <p className="text-sm text-muted-foreground">
          Рядок послуги, що друкується на актах за доступ до сервісу. Зміна застосовується до нових
          актів одразу; для вже виданих — перезапустіть «Перегенерувати всі акти».
        </p>
        <ServiceNameForm
          action={updateAccessServiceName}
          label="Назва послуги (доступ)"
          defaultValue={serviceNames.access}
        />
      </div>
    </div>
  );
}
