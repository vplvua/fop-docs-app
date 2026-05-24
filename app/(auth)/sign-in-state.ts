export interface SignInState {
  status: "idle" | "field_error" | "invalid_credentials" | "rate_limited" | "config_error";
  message?: string;
  fieldErrors?: { email?: string; password?: string };
  retryAfterSec?: number;
}

export const initialSignInState: SignInState = { status: "idle" };
