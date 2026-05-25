import { ClientCreateForm } from "./client-create-form";

interface Props {
  searchParams: Promise<{ name?: string; legal_id?: string; bank_account?: string }>;
}

export const metadata = { title: "Новий клієнт · ФОП Документи" };

export default async function NewClientPage({ searchParams }: Props) {
  const prefill = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Новий клієнт</h1>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div
          role="alert"
          className="mb-6 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200"
        >
          Без договору акти не генеруються — додайте договір у вкладці «Договір» після створення
          клієнта.
        </div>
        <ClientCreateForm prefill={prefill} />
      </div>
    </div>
  );
}
