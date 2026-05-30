/** Shared action state for the single-field "Назва послуги" editors. */
export interface ServiceNameActionState {
  status: "idle" | "success" | "error";
  message?: string;
  error?: string;
}

export const initialServiceNameActionState: ServiceNameActionState = { status: "idle" };
