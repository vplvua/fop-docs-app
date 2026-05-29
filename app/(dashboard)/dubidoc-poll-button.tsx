"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { triggerDubidocPollAction } from "./dashboard-actions";

export function DubidocPollButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePoll = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await triggerDubidocPollAction();
    setLoading(false);

    if (res.ok && res.result) {
      const { total, signed, deleted, refused, errors } = res.result;
      setMessage(
        `Опитано ${String(total)} актів: ${String(signed)} підписано, ${String(deleted)} видалено, ${String(refused)} відмовлено, ${String(errors)} помилок`,
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
        onClick={handlePoll}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Опитування…" : "Опитати статуси Дубідок"}
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
