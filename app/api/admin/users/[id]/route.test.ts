import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";
import { createUser, demoteAllAdmins, getUser, sessionTokenFor, useTempDatabase } from "@/lib/testing/temp-db";
import { PATCH } from "./route";

let cleanup: () => void;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
  cleanup = await useTempDatabase();
});

// Each test counts admins, so start each one with none (the seeded admin included)
beforeEach(demoteAllAdmins);

afterAll(() => {
  cleanup();
  vi.unstubAllEnvs();
});

async function patchUser(actor: User, targetId: number, body: object) {
  const req = new NextRequest(`https://assessments.example.com/api/admin/users/${targetId}`, {
    method: "PATCH",
    headers: { cookie: `session=${await sessionTokenFor(actor)}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: String(targetId) }) });
}

describe("PATCH /api/admin/users/[id]: input", () => {
  it("rejects isActive values other than 0 or 1", async () => {
    const admin = createUser("validating-admin", { role: "admin" });
    const target = createUser("validation-target");

    for (const isActive of [2, -1, 0.5]) {
      const res = await patchUser(admin, target.id, { isActive });
      expect(res.status, `isActive ${isActive}`).toBe(400);
    }
    expect(getUser(target.id)?.isActive).toBe(1);
  });
});

describe("PATCH /api/admin/users/[id]: last active admin", () => {
  it("won't let the only active admin demote themselves", async () => {
    const onlyAdmin = createUser("only-admin", { role: "admin" });

    const res = await patchUser(onlyAdmin, onlyAdmin.id, { role: "staff" });

    expect(res.status).toBe(409);
    expect(getUser(onlyAdmin.id)?.role).toBe("admin");
  });

  it("lets an admin demote or deactivate another while one active admin remains", async () => {
    const first = createUser("first-admin", { role: "admin" });
    const second = createUser("second-admin", { role: "admin" });
    const third = createUser("third-admin", { role: "admin" });

    expect((await patchUser(first, second.id, { role: "staff" })).status).toBe(200);
    expect((await patchUser(first, third.id, { isActive: 0 })).status).toBe(200);

    expect(getUser(second.id)?.role).toBe("staff");
    expect(getUser(third.id)?.isActive).toBe(0);

    // first-admin is now the only active admin
    expect((await patchUser(first, first.id, { role: "staff" })).status).toBe(409);
  });

  it("keeps one active admin when two admins demote each other at the same time", async () => {
    const a = createUser("racing-admin-a", { role: "admin" });
    const b = createUser("racing-admin-b", { role: "admin" });

    // A password in the request means an Argon2 hash (an await) in the handler
    const results = await Promise.all([
      patchUser(a, b.id, { role: "staff", password: "a-new-password-1" }),
      patchUser(b, a.id, { role: "staff", password: "a-new-password-2" }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const stillAdmin = [getUser(a.id), getUser(b.id)].filter((u) => u?.role === "admin");
    expect(stillAdmin).toHaveLength(1);
  });

  it("still lets the only active admin demote an inactive admin", async () => {
    const active = createUser("active-admin", { role: "admin" });
    const inactive = createUser("inactive-admin", { role: "admin", isActive: 0 });

    const res = await patchUser(active, inactive.id, { role: "staff" });

    expect(res.status).toBe(200);
    expect(getUser(inactive.id)?.role).toBe("staff");
  });
});
