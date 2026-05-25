"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { regeneratePdfAction, updateServiceDescriptionAction } from "./act-actions";
import { getDownloadUrlAction } from "./download-action";

interface Props {
  actId: string;
  status: string;
  edoProvider: string;
  serviceDescription: string;
  hasPdf: boolean;
}

function DownloadButton({ actId, hasPdf }: { actId: string; hasPdf: boolean }) {
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
      disabled={!hasPdf || loading}
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

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    await regeneratePdfAction(actId);
    setLoading(false);
    router.refresh();
  }, [actId, router]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleRegenerate}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {loading ? "Генерація…" : "Перегенерувати PDF"}
    </button>
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

export function ActDetailPanel({ actId, status, edoProvider, serviceDescription, hasPdf }: Props) {
  const canEdit = status === "draft" || edoProvider === "vchasno_external";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Опис послуги:</span>
        <EditableDescription
          actId={actId}
          serviceDescription={serviceDescription}
          canEdit={canEdit}
        />
      </div>
      <div className="flex gap-3">
        <DownloadButton actId={actId} hasPdf={hasPdf} />
        <RegenerateButton actId={actId} />
      </div>
      {hasPdf ? null : <p className="text-xs text-muted-foreground">PDF ще не згенеровано</p>}
    </div>
  );
}
