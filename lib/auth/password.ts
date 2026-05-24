import { verify } from "@node-rs/argon2";

/**
 * argon2id verify. Never throws — a malformed hash, missing native binding,
 * or any other failure resolves to `false` so callers treat it as "wrong
 * credentials" without leaking error detail to the response.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}
