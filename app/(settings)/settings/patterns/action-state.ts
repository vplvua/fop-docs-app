export interface PatternActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const initialPatternActionState: PatternActionState = { status: "idle" };
