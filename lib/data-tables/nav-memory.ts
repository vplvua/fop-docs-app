/**
 * Per-section nav memory: remembers the last query string used on each list
 * surface so the top-nav links can restore it. Backed by `sessionStorage`
 * (per-tab, cleared on close — not cross-session by design) and keyed by the
 * section path, so a filter on one section never bleeds into another.
 */

const PREFIX = "nav-memory:";

export function rememberQuery(section: string, query: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + section, query);
  } catch {
    // sessionStorage unavailable (private mode / quota) — memory is best-effort.
  }
}

export function recallQuery(section: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PREFIX + section) ?? "";
  } catch {
    return "";
  }
}
