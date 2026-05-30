"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  markActSignedAction,
  refreshDubidocStatusAction,
  retryDubidocSendAction,
  unmarkActSignedAction,
} from "./act-actions";

export function MarkSignedButton({ actId }: { actId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleMark = useCallback(async () => {
    setLoading(true);
    await markActSignedAction(actId);
    setLoading(false);
    router.refresh();
  }, [actId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleMark}
      className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90 disabled:opacity-50"
    >
      {loading ? "Оновлення…" : "Позначити підписаним"}
    </button>
  );
}

export function UnmarkSignedButton({ actId }: { actId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUnmark = useCallback(async () => {
    setLoading(true);
    await unmarkActSignedAction(actId);
    setLoading(false);
    router.refresh();
  }, [actId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleUnmark}
      className="rounded-lg border border-warning bg-card px-4 py-2 text-sm font-medium text-warning-deep transition-colors hover:bg-warning/10 disabled:opacity-50"
    >
      {loading ? "Оновлення…" : "Скасувати позначку"}
    </button>
  );
}

export function RetryDubidocButton({ actId }: { actId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRetry = useCallback(async () => {
    setLoading(true);
    await retryDubidocSendAction(actId);
    setLoading(false);
    router.refresh();
  }, [actId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleRetry}
      className="rounded-lg border border-warning bg-card px-4 py-2 text-sm font-medium text-warning-deep transition-colors hover:bg-warning/10 disabled:opacity-50"
    >
      {loading ? "Відправка…" : "Надіслати в Дубідок"}
    </button>
  );
}

export function RefreshStatusButton({ actId }: { actId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await refreshDubidocStatusAction(actId);
    setLoading(false);
    router.refresh();
  }, [actId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleRefresh}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {loading ? "Оновлення…" : "Оновити статус"}
    </button>
  );
}

export function EdoStatusBanners({
  status,
  edoProvider,
  edoStatus,
}: {
  status: string;
  edoProvider: string;
  edoStatus: string | null;
}) {
  if (edoProvider === "vchasno_external") {
    if (status === "signed") {
      return (
        <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <p className="text-sm font-medium text-success-deep">Підписано у Вчасно</p>
        </div>
      );
    }
    if (status === "draft") {
      return (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-warning-deep">Очікує підпису у Вчасно</p>
        </div>
      );
    }
    return null;
  }

  if (edoProvider !== "dubidoc") return null;

  if (status === "draft") {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
        <p className="text-sm font-medium text-warning-deep">Не відправлено в Дубідок</p>
      </div>
    );
  }

  if (status === "signed") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <p className="text-sm font-medium text-success-deep">Підписано</p>
      </div>
    );
  }

  if (edoStatus === "refused") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm font-medium text-destructive-deep">Клієнт відмовився від підпису</p>
      </div>
    );
  }

  if (status === "sent_to_edo" && edoStatus && edoStatus !== "refused") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Статус Дубідок: <span className="font-medium text-foreground">{edoStatus}</span>
        </p>
      </div>
    );
  }

  return null;
}
