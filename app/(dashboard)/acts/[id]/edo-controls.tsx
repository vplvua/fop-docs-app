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
      className="rounded-lg bg-semantic-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-semantic-success/90 disabled:opacity-50"
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
      className="rounded-lg border border-semantic-warning bg-card px-4 py-2 text-sm font-medium text-semantic-warning transition-colors hover:bg-semantic-warning/10 disabled:opacity-50"
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
      className="rounded-lg border border-semantic-warning bg-card px-4 py-2 text-sm font-medium text-semantic-warning transition-colors hover:bg-semantic-warning/10 disabled:opacity-50"
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
        <div className="rounded-lg border border-semantic-success/30 bg-semantic-success/5 px-4 py-3">
          <p className="text-sm font-medium text-semantic-success">Підписано у Вчасно</p>
        </div>
      );
    }
    if (status === "draft") {
      return (
        <div className="rounded-lg border border-semantic-warning/30 bg-semantic-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-semantic-warning">Очікує підпису у Вчасно</p>
        </div>
      );
    }
    return null;
  }

  if (edoProvider !== "dubidoc") return null;

  if (status === "draft") {
    return (
      <div className="rounded-lg border border-semantic-warning/30 bg-semantic-warning/5 px-4 py-3">
        <p className="text-sm font-medium text-semantic-warning">Не відправлено в Дубідок</p>
      </div>
    );
  }

  if (status === "signed") {
    return (
      <div className="rounded-lg border border-semantic-success/30 bg-semantic-success/5 px-4 py-3">
        <p className="text-sm font-medium text-semantic-success">Підписано</p>
      </div>
    );
  }

  if (edoStatus === "refused") {
    return (
      <div className="rounded-lg border border-semantic-error/30 bg-semantic-error/5 px-4 py-3">
        <p className="text-sm font-medium text-semantic-error">Клієнт відмовився від підпису</p>
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
