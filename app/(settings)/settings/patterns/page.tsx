import { getContractPatterns } from "@/lib/settings";

import { PatternCreateForm } from "./pattern-create-form";
import { PatternList } from "./pattern-list";
import { PatternTestArea } from "./pattern-test-area";

export const metadata = { title: "Патерни · Налаштування · ФОП Документи" };

export default async function PatternsPage() {
  const patterns = await getContractPatterns();
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Regex-патерни номера договору</h2>
      <PatternList patterns={patterns} />
      <PatternCreateForm />
      <PatternTestArea patterns={patterns} />
    </div>
  );
}
