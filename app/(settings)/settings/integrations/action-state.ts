export interface IntegrationActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialIntegrationActionState: IntegrationActionState = { status: "idle" };
