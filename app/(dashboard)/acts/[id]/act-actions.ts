"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { deleteManualAct } from "@/lib/acts/delete-manual-act";
import { generateAndStoreActPdf } from "@/lib/acts/generate-pdf";
import { isEditableManualAct } from "@/lib/acts/manual-act-eligibility";
import { manualActEditSchema, type ManualActEditInput } from "@/lib/acts/manual-act-schema";
import { refreshActSnapshots } from "@/lib/acts/refresh-snapshots";
import { updateManualAct } from "@/lib/acts/update-manual-act";
import { db } from "@/lib/db";
import { acts } from "@/lib/db/schema/acts";
import { payments } from "@/lib/db/schema/payments";
import { mapDubidocStatus } from "@/lib/edo/dubidoc-status";
import { sendActToDubidoc } from "@/lib/edo/send-to-dubidoc";
import { validateVchasnoTransition } from "@/lib/edo/vchasno-state";
import {
  deleteSigningLinks,
  DubiDocApiError,
  generateSigningLink,
  getDocumentParticipants,
  getDocumentStatus,
  sendDocument,
} from "@/lib/external-apis/dubidoc";
import { logger } from "@/lib/logging";

/**
 * Shared "the DubiDoc copy is gone" patch (deleted/cancelled). Keeps the act and
 * its payment; forgets the prior hash so a fresh document is created on re-send.
 */
async function markActRemoved(actId: string): Promise<void> {
  await db
    .update(acts)
    .set({
      status: "deleted",
      edoDocId: null,
      edoStatus: null,
      sentToEdoAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(acts.id, actId));
}

export async function regeneratePdfAction(actId: string): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ id: acts.id, edoProvider: acts.edoProvider, status: acts.status })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);
  if (!act) return { ok: false, error: "Акт не знайдено" };

  try {
    // Editable acts (never-sent draft, or removed-and-awaiting-resend) pull fresh
    // client/contract data into their snapshots first, so corrections — and
    // curated fields like the short name used for the DubiDoc title — flow into
    // the regenerated PDF and the next send. Sent/signed acts are never touched.
    if (act.status === "draft" || act.status === "deleted") {
      await refreshActSnapshots(actId);
    }
    await generateAndStoreActPdf(actId);
    // Auto-send only for a never-sent draft (first-send convenience). A removed
    // act (`deleted`) is re-sent explicitly via the "Надіслати в Дубідок" button
    // so the admin can review the regenerated PDF first.
    if (act.edoProvider === "dubidoc" && act.status === "draft") {
      sendActToDubidoc(actId).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Невідома помилка";
    return { ok: false, error: `Помилка генерації PDF: ${msg}` };
  }
}

export async function updateServiceDescriptionAction(
  actId: string,
  description: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  // `deleted` = removed in DubiDoc and awaiting re-send → editable like a draft.
  const canEdit =
    act.status === "draft" || act.status === "deleted" || act.edoProvider === "vchasno_external";
  if (!canEdit) {
    return { ok: false, error: "Редагування заблоковано для цього статусу" };
  }

  await db
    .update(acts)
    .set({ serviceDescription: description, updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  generateAndStoreActPdf(actId).catch(() => {});

  return { ok: true };
}

/**
 * Load an act with its backing payment `source` to decide whether it is an
 * editable manual act. Shared guard for the edit/delete actions below.
 */
async function loadManualActGuard(actId: string) {
  const [row] = await db
    .select({
      status: acts.status,
      edoProvider: acts.edoProvider,
      source: payments.source,
    })
    .from(acts)
    .innerJoin(payments, eq(acts.paymentId, payments.id))
    .where(eq(acts.id, actId))
    .limit(1);
  return row;
}

export async function updateManualActAction(
  actId: string,
  input: ManualActEditInput,
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadManualActGuard(actId);
  if (!row) return { ok: false, error: "Акт не знайдено" };
  if (!isEditableManualAct(row)) {
    return { ok: false, error: "Редагувати можна лише ручний акт, який ще не відправлено в ЕДО" };
  }

  const parsed = manualActEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Перевірте поля форми" };

  try {
    await updateManualAct(actId, parsed.data);
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error(
      { event: "manual_act.update_action_error", actId, error: message },
      "update failed",
    );
    return { ok: false, error: `Не вдалося оновити акт: ${message}` };
  }
}

export async function deleteManualActAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadManualActGuard(actId);
  if (!row) return { ok: false, error: "Акт не знайдено" };
  if (!isEditableManualAct(row)) {
    return { ok: false, error: "Видалити можна лише ручний акт, який ще не відправлено в ЕДО" };
  }

  try {
    await deleteManualAct(actId);
    revalidatePath("/acts");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error(
      { event: "manual_act.delete_action_error", actId, error: message },
      "delete failed",
    );
    return { ok: false, error: `Не вдалося видалити акт: ${message}` };
  }
}

export async function markActSignedAction(actId: string): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  const validation = validateVchasnoTransition(act.status, "signed", act.edoProvider);
  if (!validation.ok) return { ok: false, error: validation.error };

  await db
    .update(acts)
    .set({ status: "signed", updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  return { ok: true };
}

export async function unmarkActSignedAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };

  const validation = validateVchasnoTransition(act.status, "draft", act.edoProvider);
  if (!validation.ok) return { ok: false, error: validation.error };

  await db
    .update(acts)
    .set({ status: "draft", updatedAt: sql`now()` })
    .where(eq(acts.id, actId));

  return { ok: true };
}

export async function retryDubidocSendAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sendActToDubidoc(actId);
    if (result.skipped) return { ok: true };
    if (result.sent) return { ok: true };
    return { ok: false, error: result.error ?? "Не вдалося відправити" };
  } catch {
    return { ok: false, error: "Помилка відправки в Дубідок" };
  }
}

export async function refreshDubidocStatusAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ edoDocId: acts.edoDocId, status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (act.edoProvider !== "dubidoc") return { ok: false, error: "Акт не є Дубідок" };
  if (!act.edoDocId) return { ok: false, error: "Акт ще не відправлено" };

  try {
    const response = await getDocumentStatus(act.edoDocId);
    const edoDocId = act.edoDocId;
    const patch = await mapDubidocStatus(response, () => getDocumentParticipants(edoDocId));

    // Cancelled (анульовано) in DubiDoc → remove the live copy, keep act+payment.
    if (patch.status === "deleted") {
      await markActRemoved(actId);
      return { ok: true };
    }

    await db
      .update(acts)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        edoStatus: patch.edoStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(acts.id, actId));

    return { ok: true };
  } catch (err) {
    // Deleted before signing → 404. Mark removed (keep payment) so it can be re-sent.
    if (err instanceof DubiDocApiError && err.statusCode === 404) {
      await markActRemoved(actId);
      return { ok: true };
    }
    return { ok: false, error: "Помилка оновлення статусу з Дубідок" };
  }
}

/**
 * Generate a public DubiDoc signing URL for the FOP's own (first) signature so
 * it can be embedded in an iframe modal. Guarded to acts that are sent to
 * DubiDoc and still awaiting the FOP's signature (`sent_to_edo`). The DubiDoc
 * access token never leaves the server — the client receives only the URL.
 */
export async function getSigningLinkAction(
  actId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const [act] = await db
    .select({ edoDocId: acts.edoDocId, status: acts.status, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (act.edoProvider !== "dubidoc") return { ok: false, error: "Акт не є Дубідок" };
  if (act.status !== "sent_to_edo") {
    return { ok: false, error: "Підписати можна лише акт, що очікує вашого підпису" };
  }
  if (!act.edoDocId) return { ok: false, error: "Акт ще не відправлено" };

  try {
    const { link } = await generateSigningLink(act.edoDocId);
    return { ok: true, url: link };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.error(
      { event: "edo.sign_link_error", actId, edoDocId: act.edoDocId, error: message },
      "Failed to generate DubiDoc signing link",
    );
    return { ok: false, error: "Не вдалося отримати посилання для підпису" };
  }
}

/**
 * Revoke the public signing link(s) for an act after the FOP has signed (or
 * dismissed the modal), minimizing the window the public URL is usable.
 * Idempotent and best-effort: a failed DELETE is logged but never blocks the
 * flow, since the link is short-lived and only the admin ever saw it.
 */
export async function revokeSigningLinkAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ edoDocId: acts.edoDocId, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (act.edoProvider !== "dubidoc" || !act.edoDocId) return { ok: true };

  try {
    await deleteSigningLinks(act.edoDocId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.warn(
      { event: "edo.sign_link_revoke_failed", actId, edoDocId: act.edoDocId, error: message },
      "Failed to revoke DubiDoc signing link",
    );
  }

  return { ok: true };
}

/**
 * Finalize the in-app signing modal once the FOP closes it. Signing via the
 * public link only applies the FOP's (owner) signature — unlike the website's
 * "Підписати та надіслати", it does NOT advance the sequential route. So when
 * the FOP has signed (`state = new`, org `status = signed`) we explicitly call
 * `/send` to forward the document to the client. Then the public link is revoked
 * and the act status is refreshed (now driven by document-level `state`).
 *
 * Forward + revoke are best-effort (logged, never block); status refresh is the
 * authoritative result returned to the caller.
 */
export async function finalizeInAppSigningAction(
  actId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [act] = await db
    .select({ edoDocId: acts.edoDocId, edoProvider: acts.edoProvider })
    .from(acts)
    .where(eq(acts.id, actId))
    .limit(1);

  if (!act) return { ok: false, error: "Акт не знайдено" };
  if (act.edoProvider !== "dubidoc" || !act.edoDocId) return { ok: true };

  // Forward to the client if the FOP just signed but the route hasn't advanced.
  try {
    const status = await getDocumentStatus(act.edoDocId);
    if (status.state === "new" && status.status === "signed") {
      await sendDocument(act.edoDocId);
      logger.info(
        { event: "edo.sent_for_client_sign", actId, edoDocId: act.edoDocId },
        "Forwarded signed document to client",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Невідома помилка";
    logger.warn(
      { event: "edo.forward_failed", actId, edoDocId: act.edoDocId, error: message },
      "Failed to forward signed document to client",
    );
  }

  await revokeSigningLinkAction(actId);
  return refreshDubidocStatusAction(actId);
}
