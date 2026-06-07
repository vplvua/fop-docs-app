"use client";

import { toast } from "sonner";

/** Transient success confirmation (e.g. after a save). */
export function toastSuccess(message: string): void {
  toast.success(message);
}

/** Transient error notice; complements inline field errors, never replaces them. */
export function toastError(message: string): void {
  toast.error(message);
}

/** Transient warning notice (amber) for non-blocking cautions. */
export function toastWarning(message: string): void {
  toast.warning(message);
}
