/**
 * Operator-facing display name for a client.
 *
 * Returns the curated `shortName` when it is a non-empty (trimmed) string,
 * otherwise falls back to the full legal `name`. The fallback guarantees a
 * client is never displayed blank, and casing is preserved exactly as stored
 * (the operator controls it — see the `clients` spec).
 */
export function displayClientName(client: { name: string; shortName?: string | null }): string {
  const short = client.shortName?.trim();
  return short ? short : client.name;
}
