import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

/**
 * Hash a password using Argon2id (OWASP recommended).
 * All new hashes are Argon2id. Existing bcrypt hashes are still accepted by verifyPassword.
 */
export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password);
}

/**
 * Verify a password against a stored hash.
 * Detects hash type by prefix:
 *   $2b$ / $2a$ / $2y$ → bcrypt (legacy)
 *   $argon2id$         → Argon2id (current)
 *
 * Call hashPassword and update the stored hash after a successful bcrypt
 * verification to transparently migrate existing accounts to Argon2id.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2b$") || hash.startsWith("$2a$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }
  return argon2Verify(hash, password);
}
