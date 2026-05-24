/**
 * Sanitize a post-login redirect target. Only same-origin, absolute path
 * values are allowed — anything else (full URL, scheme-relative `//host`,
 * `javascript:`, empty) collapses to `/` to defeat open-redirect tricks.
 */
export function parseSafeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.startsWith("/\\")) return "/";
  return value;
}
