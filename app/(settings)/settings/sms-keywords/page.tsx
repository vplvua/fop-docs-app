import { getSmsKeywords } from "@/lib/settings";

import { KeywordEditor } from "./keyword-editor";

export const metadata = { title: "Ключові слова СМС · Налаштування · ФОП Документи" };

export default async function SmsKeywordsPage() {
  const keywords = await getSmsKeywords();
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Ключові слова СМС</h2>
      <p className="text-sm text-muted-foreground">
        Якщо призначення платежу містить одне з цих слів, тип послуги визначається як СМС.
      </p>
      <KeywordEditor keywords={keywords} />
    </div>
  );
}
