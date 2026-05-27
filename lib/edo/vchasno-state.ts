type ActStatus = "draft" | "sent_to_edo" | "signed" | "deleted";
type EdoProvider = "dubidoc" | "vchasno_external";

type TransitionResult = { ok: true } | { ok: false; error: string };

export function validateVchasnoTransition(
  currentStatus: ActStatus,
  targetStatus: ActStatus,
  edoProvider: EdoProvider,
): TransitionResult {
  if (edoProvider !== "vchasno_external") {
    return { ok: false, error: "Операція доступна лише для Вчасно-актів" };
  }

  if (currentStatus === "draft" && targetStatus === "signed") {
    return { ok: true };
  }

  if (currentStatus === "signed" && targetStatus === "draft") {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Неможливий перехід зі статусу "${currentStatus}" в "${targetStatus}"`,
  };
}
