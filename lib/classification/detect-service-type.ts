import type { ServiceType } from "./types";

export function detectServiceType(purpose: string, smsKeywords: string[]): ServiceType {
  const lower = purpose.toLowerCase();
  for (const keyword of smsKeywords) {
    if (lower.includes(keyword.toLowerCase())) {
      return "sms";
    }
  }
  return "access";
}
