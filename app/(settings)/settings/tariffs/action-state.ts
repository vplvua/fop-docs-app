export interface TariffActionState {
  status: "idle" | "success" | "field_error" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialTariffActionState: TariffActionState = { status: "idle" };
