import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: number;
  username: string;
  displayName: string;
  role: string; // "admin" | "staff"
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
