import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signPreAuthToken } from "@/lib/auth";
import type { User } from "@/lib/db/schema";
import { createUser, sessionTokenFor, updateUser, useTempDatabase } from "@/lib/testing/temp-db";
import { proxy } from "./proxy";

let cleanup: () => void;
let staff: User;
let admin: User;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
  cleanup = await useTempDatabase();
  staff = createUser("bob");
  admin = createUser("alice", { role: "admin" });
});

afterAll(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function request(path: string, sessionCookie?: string): NextRequest {
  return new NextRequest(`https://assessments.example.com${path}`, {
    headers: sessionCookie ? { cookie: `session=${sessionCookie}` } : {},
  });
}

function redirectPath(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

function passedThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  it("lets a signed-in user reach staff pages and APIs", async () => {
    const token = await sessionTokenFor(staff);

    expect(passedThrough(await proxy(request("/customers", token)))).toBe(true);
    expect(passedThrough(await proxy(request("/api/customers", token)))).toBe(true);
  });

  it("sends visitors without a session to the login page, or 401 for APIs", async () => {
    expect(redirectPath(await proxy(request("/customers")))).toBe("/login");
    expect((await proxy(request("/api/customers"))).status).toBe(401);
  });

  it("does not accept the MFA pre-auth token as a session", async () => {
    const preAuth = await signPreAuthToken({
      userId: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: "admin",
      mfaPending: true,
    });

    expect(redirectPath(await proxy(request("/admin/users", preAuth)))).toBe("/login");
    expect((await proxy(request("/api/admin/users", preAuth))).status).toBe(401);
  });

  it("keeps staff out of admin pages and APIs", async () => {
    const token = await sessionTokenFor(staff);

    expect(redirectPath(await proxy(request("/admin/users", token)))).toBe("/dashboard");
    expect((await proxy(request("/api/admin/users", token))).status).toBe(403);
  });

  it("lets admins into admin pages and APIs", async () => {
    const token = await sessionTokenFor(admin);

    expect(passedThrough(await proxy(request("/admin/users", token)))).toBe(true);
    expect(passedThrough(await proxy(request("/api/admin/users", token)))).toBe(true);
  });

  it("signs out a user as soon as they're deactivated", async () => {
    const user = createUser("carol");
    const token = await sessionTokenFor(user);
    expect(passedThrough(await proxy(request("/customers", token)))).toBe(true);

    updateUser(user.id, { isActive: 0 });

    const page = await proxy(request("/customers", token));
    expect(redirectPath(page)).toBe("/login");
    expect(page.headers.get("set-cookie")).toMatch(/session=;/);
    expect((await proxy(request("/api/customers", token))).status).toBe(401);
  });

  it("treats a demoted admin as staff straight away", async () => {
    const user = createUser("dave", { role: "admin" });
    const token = await sessionTokenFor(user);
    expect(passedThrough(await proxy(request("/admin/users", token)))).toBe(true);

    updateUser(user.id, { role: "staff" });

    expect(redirectPath(await proxy(request("/admin/users", token)))).toBe("/dashboard");
    expect((await proxy(request("/api/admin/users", token))).status).toBe(403);
    expect(passedThrough(await proxy(request("/customers", token)))).toBe(true);
  });

  it("leaves the public login, MFA challenge and assessment-link routes open", async () => {
    for (const path of ["/login", "/api/auth/login", "/api/auth/mfa/challenge", "/assess/abc", "/api/assess/abc"]) {
      expect(passedThrough(await proxy(request(path))), path).toBe(true);
    }
  });
});
