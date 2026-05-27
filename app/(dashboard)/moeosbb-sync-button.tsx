"use client";

import { useCallback, useState } from "react";

import { triggerMoeosbbSyncAction } from "./dashboard-actions";

export function MoeosbbSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await triggerMoeosbbSyncAction();
    setLoading(false);

    if (res.ok && res.result) {
      const { fetched, matched, updated, created } = res.result;
      setMessage(
        `Отримано ${String(fetched)}, знайдено ${String(matched)}, оновлено ${String(updated)}, створено ${String(created)}`,
      );
    } else {
      setMessage(res.error ?? "Помилка");
    }
  }, []);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={handleSync}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Синхронізація…" : "Синхронізувати Моє ОСББ зараз"}
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
