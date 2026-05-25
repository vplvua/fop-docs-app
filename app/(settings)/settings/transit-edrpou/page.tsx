import { getTransitEdrpouList } from "@/lib/settings";

import { EdrpouEditor } from "./edrpou-editor";

export const metadata = { title: "Транзитні ЄДРПОУ · Налаштування · ФОП Документи" };

export default async function TransitEdrpouPage() {
  const items = await getTransitEdrpouList();
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Транзитні ЄДРПОУ</h2>
      <p className="text-sm text-muted-foreground">
        ЄДРПОУ транзитних рахунків банків. Для таких платежів класифікатор не перевіряє ЄДРПОУ
        платника.
      </p>
      <EdrpouEditor items={items} />
    </div>
  );
}
