export interface ClientActionState {
  status: "idle" | "success" | "field_error" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialClientActionState: ClientActionState = { status: "idle" };
