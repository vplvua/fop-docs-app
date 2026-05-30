"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { triggerRegenerateActsAction } from "./dashboard-actions";

export function RegenerateActsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await triggerRegenerateActsAction();
    setLoading(false);

    if (res.ok && res.result) {
      const { total, regenerated, backfilled, failed } = res.result;
      setMessage(
        `Усього ${String(total)}, перегенеровано ${String(regenerated)}, заповнено реквізити ${String(backfilled)}, помилок ${String(failed)}`,
      );
      router.refresh();
    } else {
      setMessage(res.error ?? "Помилка");
    }
  }, [router]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={handleRegenerate}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Перегенерація…" : "Перегенерувати всі акти"}
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
