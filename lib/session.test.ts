import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isAuthError, requireAdmin, requireSession } from "@/lib/api-auth";
import { getSession } from "@/lib/session";
import { createUser, sessionTokenFor, updateUser, useTempDatabase } from "@/lib/testing/temp-db";

let cleanup: () => void;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
  cleanup = await useTempDatabase();
});

afterAll(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function requestWith(token: string): NextRequest {
  return new NextRequest("https://assessments.example.com/api/customers", {
    headers: { cookie: `session=${token}` },
  });
}

describe("getSession", () => {
  it("returns the session for an active user", async () => {
    const user = createUser("active-user");

    const session = await getSession(await sessionTokenFor(user));

    expect(session).toMatchObject({ userId: user.id, username: "active-user", role: "staff" });
  });

  it("rejects a token once its user is deactivated", async () => {
    const user = createUser("deactivated-user");
    const token = await sessionTokenFor(user);

    updateUser(user.id, { isActive: 0 });

    expect(await getSession(token)).toBeNull();
  });

  it("uses the role in the database, not the one in the token", async () => {
    const user = createUser("demoted-admin", { role: "admin" });
    const token = await sessionTokenFor(user);

    updateUser(user.id, { role: "staff" });

    expect(await getSession(token)).toMatchObject({ userId: user.id, role: "staff" });
  });

  it("rejects a token issued before the user's password changed", async () => {
    const user = createUser("password-changed", { passwordChangedAt: 1_700_000_000 });
    const token = await sessionTokenFor(user);

    updateUser(user.id, { passwordChangedAt: 1_700_000_500 });

    expect(await getSession(token)).toBeNull();
  });

  it("rejects a token for a user who no longer exists", async () => {
    const ghost = { ...createUser("deleted-user"), id: 999_999 };

    expect(await getSession(await sessionTokenFor(ghost))).toBeNull();
  });

  it("rejects a missing or malformed token", async () => {
    expect(await getSession(undefined)).toBeNull();
    expect(await getSession("not-a-jwt")).toBeNull();
  });
});

describe("requireSession / requireAdmin", () => {
  it("return 401 for a deactivated user", async () => {
    const user = createUser("deactivated-api-user");
    const token = await sessionTokenFor(user);
    updateUser(user.id, { isActive: 0 });

    const result = await requireSession(requestWith(token));

    expect(isAuthError(result) && result.status).toBe(401);
  });

  it("return 403 from requireAdmin once an admin is demoted", async () => {
    const user = createUser("demoted-api-admin", { role: "admin" });
    const token = await sessionTokenFor(user);
    expect(isAuthError(await requireAdmin(requestWith(token)))).toBe(false);

    updateUser(user.id, { role: "staff" });

    const result = await requireAdmin(requestWith(token));
    expect(isAuthError(result) && result.status).toBe(403);
  });
});
