"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { triggerPrivatbankPollNow } from "./payments/actions";

export function PrivatbankPollButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePoll = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const res = await triggerPrivatbankPollNow();
    setLoading(false);

    if (res.error) {
      setMessage(res.error);
      return;
    }
    setMessage(`Отримано ${String(res.total)}, додано ${String(res.inserted)}`);
    router.refresh();
  }, [router]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={handlePoll}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Синхронізація…" : "Синхронізувати ПриватБанк зараз"}
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
