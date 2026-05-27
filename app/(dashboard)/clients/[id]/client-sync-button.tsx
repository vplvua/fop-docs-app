"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { syncSingleClientAction } from "./sync-actions";

export function ClientSyncButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSync = useCallback(async () => {
    setLoading(true);
    const res = await syncSingleClientAction(clientId);
    setLoading(false);
    if (res.ok) router.refresh();
  }, [clientId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleSync}
      className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
    >
      {loading ? "Синхронізація…" : "Синхронізувати"}
    </button>
  );
}
