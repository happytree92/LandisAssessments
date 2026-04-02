import { SignJWT, jwtVerify } from "jose";
import { createHash } from "crypto";

export interface SessionPayload {
  userId: number;
  username: string;
  displayName: string;
  role: string; // "admin" | "staff"
  /**
   * Mirrors users.password_changed_at at the time the token was signed.
   * requireSession validates this against the DB to invalidate sessions after
   * a password change. Absent on tokens issued before this field was added.
   */
  pwdAt?: number;
}

/**
 * Returns the first 16 hex chars of SHA-256(token).
 * Safe to store in logs — identifies a session without exposing the token.
 */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * Short-lived token issued after password validation when MFA is required.
 * The full session cookie is only set after the TOTP code is verified.
 */
export interface PreAuthPayload {
  userId: number;
  username: string;
  displayName: string;
  role: string;
  mfaPending: true;
}

// JWT secret is required — throw on startup if missing
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET env var is required but not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const p = payload as unknown as SessionPayload;
  // Tokens issued before role was added — treat as staff
  if (!p.role) p.role = "staff";
  return p;
}

/** Sign a pre-auth token for MFA second-factor challenge (expires in 5 minutes). */
export async function signPreAuthToken(payload: PreAuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}

/** Verify a pre-auth token. Throws if invalid, expired, or not a pre-auth token. */
export async function verifyPreAuthToken(token: string): Promise<PreAuthPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const p = payload as unknown as PreAuthPayload;
  if (!p.mfaPending) throw new Error("Not a pre-auth token");
  return p;
}
