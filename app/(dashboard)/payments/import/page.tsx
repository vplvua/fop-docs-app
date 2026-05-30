import Link from "next/link";

import { StatementImport } from "./statement-import";

export const metadata = { title: "Завантажити платіж за датою · ФОП Документи" };

export default function ImportPaymentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-2 text-foreground">Завантажити платіж за датою</h1>
        <Link href="/payments" className="text-sm text-muted-foreground hover:text-foreground">
          ← До платежів
        </Link>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Підтягніть платіж із ПриватБанку за відомою датою (наприклад, який пропустила автоматична
        синхронізація або який стосується періоду до запуску). Платежі, що вже є в системі,
        позначаються й повторно не імпортуються.
      </p>
      <StatementImport />
    </div>
  );
}
