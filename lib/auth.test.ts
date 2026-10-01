import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signPreAuthToken,
  signToken,
  tokenFingerprint,
  verifyPreAuthToken,
  verifyToken,
  type PreAuthPayload,
  type SessionPayload,
} from "./auth";

const SECRET = "test-secret-that-is-at-least-32-characters";

const session: SessionPayload = {
  userId: 7,
  username: "alice",
  displayName: "Alice",
  role: "staff",
  pwdAt: 1_700_000_000,
};

const preAuth: PreAuthPayload = {
  userId: 7,
  username: "alice",
  displayName: "Alice",
  role: "staff",
  mfaPending: true,
};

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function freezeClock(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

describe("session tokens", () => {
  it("round-trip the session payload", async () => {
    const payload = await verifyToken(await signToken(session));

    expect(payload).toMatchObject(session);
  });

  it("are rejected when signed with a different secret", async () => {
    const token = await signToken(session);
    vi.stubEnv("JWT_SECRET", "a-different-secret-also-32-characters-long");

    await expect(verifyToken(token)).rejects.toThrow();
  });

  it("are rejected when the payload is altered", async () => {
    const [header, , signature] = (await signToken(session)).split(".");
    const promoted = Buffer.from(JSON.stringify({ ...session, role: "admin" })).toString("base64url");

    await expect(verifyToken(`${header}.${promoted}.${signature}`)).rejects.toThrow();
  });

  it("expire after 8 hours", async () => {
    freezeClock("2026-01-01T09:00:00Z");
    const token = await signToken(session);

    vi.setSystemTime(new Date("2026-01-01T16:59:00Z"));
    await expect(verifyToken(token)).resolves.toMatchObject({ userId: 7 });

    vi.setSystemTime(new Date("2026-01-01T17:01:00Z"));
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it("default to the staff role when issued before roles existed", async () => {
    const legacy = { userId: 7, username: "alice", displayName: "Alice" } as SessionPayload;

    const payload = await verifyToken(await signToken(legacy));

    expect(payload.role).toBe("staff");
  });

  it("cannot be signed or verified when JWT_SECRET is unset", async () => {
    const token = await signToken(session);
    vi.stubEnv("JWT_SECRET", "");

    await expect(signToken(session)).rejects.toThrow("JWT_SECRET");
    await expect(verifyToken(token)).rejects.toThrow("JWT_SECRET");
  });
});

describe("pre-auth tokens", () => {
  it("round-trip the pre-auth payload", async () => {
    const payload = await verifyPreAuthToken(await signPreAuthToken(preAuth));

    expect(payload).toMatchObject(preAuth);
  });

  it("reject a full session token", async () => {
    const token = await signToken(session);

    await expect(verifyPreAuthToken(token)).rejects.toThrow("Not a pre-auth token");
  });

  it("expire after 5 minutes", async () => {
    freezeClock("2026-01-01T09:00:00Z");
    const token = await signPreAuthToken(preAuth);

    vi.setSystemTime(new Date("2026-01-01T09:04:59Z"));
    await expect(verifyPreAuthToken(token)).resolves.toMatchObject({ userId: 7 });

    vi.setSystemTime(new Date("2026-01-01T09:05:01Z"));
    await expect(verifyPreAuthToken(token)).rejects.toThrow();
  });
});

describe("tokenFingerprint", () => {
  it("is the first 16 hex characters of the token's SHA-256", () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(tokenFingerprint("abc")).toBe("ba7816bf8f01cfea");
  });

  it("differs between tokens", () => {
    expect(tokenFingerprint("header.payload.one")).not.toBe(tokenFingerprint("header.payload.two"));
  });
});
