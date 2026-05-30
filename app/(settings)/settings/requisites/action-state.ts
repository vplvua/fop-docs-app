export interface RequisitesActionState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Per-field validation messages keyed by field name. */
  fieldErrors?: Record<string, string>;
}

export const initialRequisitesActionState: RequisitesActionState = { status: "idle" };
