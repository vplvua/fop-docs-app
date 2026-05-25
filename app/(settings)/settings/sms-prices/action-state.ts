export interface SmsPriceActionState {
  status: "idle" | "success" | "field_error" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialSmsPriceActionState: SmsPriceActionState = { status: "idle" };
