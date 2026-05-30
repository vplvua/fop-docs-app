import { getFopRequisites } from "@/lib/requisites";

import { RequisitesForm } from "./requisites-form";

export const metadata = { title: "Реквізити · Налаштування · ФОП Документи" };

export default async function RequisitesPage() {
  const requisites = await getFopRequisites();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Реквізити ФОП</h2>
      <p className="text-sm text-muted-foreground">
        Ці дані друкуються на актах. Вони фіксуються на акті в момент його генерації — зміна тут не
        впливає на вже створені акти.
      </p>

      {requisites == null ? (
        <p className="text-sm text-muted-foreground">
          Реквізити ще не заповнені. Заповніть форму нижче — без них акти не генеруються.
        </p>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <RequisitesForm defaults={requisites} />
      </div>
    </div>
  );
}
