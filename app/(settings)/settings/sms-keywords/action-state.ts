export interface ListActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialListActionState: ListActionState = { status: "idle" };
