import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signPreAuthToken, signToken, type SessionPayload } from "@/lib/auth";
import { proxy } from "./proxy";

const staff: SessionPayload = { userId: 2, username: "bob", displayName: "Bob", role: "staff" };
const admin: SessionPayload = { userId: 1, username: "admin", displayName: "Admin", role: "admin" };

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
});

afterEach(() => {
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
    const token = await signToken(staff);

    expect(passedThrough(await proxy(request("/customers", token)))).toBe(true);
    expect(passedThrough(await proxy(request("/api/customers", token)))).toBe(true);
  });

  it("sends visitors without a session to the login page, or 401 for APIs", async () => {
    expect(redirectPath(await proxy(request("/customers")))).toBe("/login");
    expect((await proxy(request("/api/customers"))).status).toBe(401);
  });

  it("does not accept the MFA pre-auth token as a session", async () => {
    const preAuth = await signPreAuthToken({ ...admin, mfaPending: true });

    expect(redirectPath(await proxy(request("/admin/users", preAuth)))).toBe("/login");
    expect((await proxy(request("/api/admin/users", preAuth))).status).toBe(401);
  });

  it("keeps staff out of admin pages and APIs", async () => {
    const token = await signToken(staff);

    expect(redirectPath(await proxy(request("/admin/users", token)))).toBe("/dashboard");
    expect((await proxy(request("/api/admin/users", token))).status).toBe(403);
  });

  it("lets admins into admin pages and APIs", async () => {
    const token = await signToken(admin);

    expect(passedThrough(await proxy(request("/admin/users", token)))).toBe(true);
    expect(passedThrough(await proxy(request("/api/admin/users", token)))).toBe(true);
  });

  it("leaves the public login, MFA challenge and assessment-link routes open", async () => {
    for (const path of ["/login", "/api/auth/login", "/api/auth/mfa/challenge", "/assess/abc", "/api/assess/abc"]) {
      expect(passedThrough(await proxy(request(path))), path).toBe(true);
    }
  });
});
