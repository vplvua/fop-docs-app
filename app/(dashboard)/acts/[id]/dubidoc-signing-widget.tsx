"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { finalizeInAppSigningAction, getSigningLinkAction } from "./act-actions";

interface Props {
  actId: string;
  edoDocId: string;
  onClose: () => void;
}

// DubiDoc's signing page is cross-origin and needs scripts, forms and popups
// (Diia/Mono/SmartID cloud flows) to function inside the frame. SPIKE (task 1)
// must confirm signing completes under these flags before release.
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads";

interface BodyProps {
  url: string | null;
  error: string | null;
  edoDocId: string;
}

function SigningBody({ url, error, edoDocId }: BodyProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const handleIframeLoad = useCallback(() => setIframeLoading(false), []);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="text-sm text-destructive-deep">{error}</p>
        <a
          href={`https://my.dubidoc.com.ua/documents/${edoDocId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
        >
          Перейти в Дубідок
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      {iframeLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
          <p className="text-sm text-muted-foreground">Завантажуємо форму підпису…</p>
        </div>
      ) : null}
      {url ? (
        <iframe
          src={url}
          title="Дубідок — підписання документа"
          className="h-[70vh] w-full border-0"
          sandbox={IFRAME_SANDBOX}
          allow="clipboard-write"
          onLoad={handleIframeLoad}
        />
      ) : null}
    </div>
  );
}

/**
 * Modal that embeds the DubiDoc signing page in an iframe so the FOP can place
 * their own (first) signature without leaving the app. On open it fetches a
 * public sign URL via `getSigningLinkAction`; on close it revokes the link and
 * refreshes the act status (`new → waiting_for_client_sign`).
 */
export function DubidocSigningModal({ actId, edoDocId, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getSigningLinkAction(actId);
      if (cancelled) return;
      if (result.ok && result.url) {
        setUrl(result.url);
      } else {
        setError(result.error ?? "Не вдалося отримати посилання для підпису");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actId]);

  const handleClose = useCallback(async () => {
    setClosing(true);
    // Forwards the freshly-signed doc to the client, revokes the public link,
    // and refreshes the act status — all best-effort server-side.
    await finalizeInAppSigningAction(actId);
    router.refresh();
    onClose();
  }, [actId, onClose, router]);

  // Esc / backdrop dismiss must still revoke + refresh, so intercept `cancel`.
  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      void handleClose();
    },
    [handleClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      aria-label="Підписання документа в Дубідок"
      // `m-auto` restores native modal centering — Tailwind preflight resets the
      // dialog's UA `margin: auto` to 0, which otherwise pins it to the top-left.
      className="m-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-lg border border-border bg-card p-0 shadow-lg backdrop:bg-black/50"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Підписання документа</h2>
          <button
            type="button"
            disabled={closing}
            onClick={handleClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {closing ? "Оновлення…" : "Готово"}
          </button>
        </div>

        <SigningBody url={url} error={error} edoDocId={edoDocId} />

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Після підписання натисніть «Готово», щоб оновити статус акта.
          </p>
        </div>
      </div>
    </dialog>
  );
}
