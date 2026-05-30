"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { regeneratePdfAction, updateServiceDescriptionAction } from "./act-actions";
import { getDownloadUrlAction } from "./download-action";
import {
  EdoStatusBanners,
  MarkSignedButton,
  RefreshStatusButton,
  RetryDubidocButton,
  UnmarkSignedButton,
} from "./edo-controls";

interface Props {
  actId: string;
  status: string;
  edoProvider: string;
  serviceDescription: string;
  edoDocId: string | null;
  edoStatus: string | null;
}

function DownloadButton({ actId }: { actId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    const result = await getDownloadUrlAction(actId);
    setLoading(false);
    if (result.ok && result.url) {
      window.open(result.url, "_blank");
    }
  }, [actId]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDownload}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? "Завантаження…" : "Скачати PDF"}
    </button>
  );
}

function RegenerateButton({ actId }: { actId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await regeneratePdfAction(actId);
    setLoading(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error ?? "Невідома помилка");
    }
  }, [actId, router]);

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleRegenerate}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {loading ? "Генерація…" : "Перегенерувати PDF"}
      </button>
      {error ? <p className="mt-1 text-xs text-destructive-deep">{error}</p> : null}
    </div>
  );
}

interface EditableDescProps {
  actId: string;
  serviceDescription: string;
  canEdit: boolean;
}

function EditableDescription({ actId, serviceDescription, canEdit }: EditableDescProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(serviceDescription);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await updateServiceDescriptionAction(actId, desc);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }, [actId, desc, router]);

  const handleStartEdit = useCallback(() => setEditing(true), []);
  const handleCancel = useCallback(() => {
    setEditing(false);
    setDesc(serviceDescription);
  }, [serviceDescription]);
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDesc(e.target.value),
    [],
  );

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={desc}
          onChange={handleChange}
          aria-label="Опис послуги"
          className="block h-8 w-80 rounded-md border border-input bg-background px-2 text-sm"
        />
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          {saving ? "…" : "Зберегти"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Скасувати
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{serviceDescription}</span>
      {canEdit ? (
        <button
          type="button"
          onClick={handleStartEdit}
          className="text-xs text-primary underline underline-offset-2"
        >
          Редагувати
        </button>
      ) : null}
    </div>
  );
}

export function ActDetailPanel({
  actId,
  status,
  edoProvider,
  serviceDescription,
  edoDocId,
  edoStatus,
}: Props) {
  const canEdit = status === "draft" || edoProvider === "vchasno_external";
  const showRetry = status === "draft" && edoProvider === "dubidoc";
  const showRefresh = status === "sent_to_edo" && edoProvider === "dubidoc";
  const showDubidocLink = edoProvider === "dubidoc" && edoDocId;
  const showMarkSigned = edoProvider === "vchasno_external" && status === "draft";
  const showUnmarkSigned = edoProvider === "vchasno_external" && status === "signed";

  return (
    <div className="space-y-4">
      <EdoStatusBanners status={status} edoProvider={edoProvider} edoStatus={edoStatus} />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Опис послуги:</span>
        <EditableDescription
          actId={actId}
          serviceDescription={serviceDescription}
          canEdit={canEdit}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <DownloadButton actId={actId} />
        <RegenerateButton actId={actId} />
        {showMarkSigned ? <MarkSignedButton actId={actId} /> : null}
        {showUnmarkSigned ? <UnmarkSignedButton actId={actId} /> : null}
        {showRetry ? <RetryDubidocButton actId={actId} /> : null}
        {showRefresh ? <RefreshStatusButton actId={actId} /> : null}
        {showDubidocLink ? (
          <a
            href={`https://my.dubidoc.com.ua/documents/${edoDocId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            Перейти в Дубідок
          </a>
        ) : null}
      </div>
    </div>
  );
}
