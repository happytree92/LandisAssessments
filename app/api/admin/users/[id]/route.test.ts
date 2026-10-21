import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";
import { createUser, getUser, sessionTokenFor, updateUser, useTempDatabase } from "@/lib/testing/temp-db";
import { PATCH } from "./route";

let cleanup: () => void;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-at-least-32-characters");
  cleanup = await useTempDatabase();
  // The seeded default admin would otherwise count as a second active admin
  updateUser(1, { role: "staff" });
});

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

describe("PATCH /api/admin/users/[id]: last active admin", () => {
  it("won't let the only active admin demote themselves", async () => {
    const onlyAdmin = createUser("only-admin", { role: "admin" });

    const res = await patchUser(onlyAdmin, onlyAdmin.id, { role: "staff" });

    expect(res.status).toBe(409);
    expect(getUser(onlyAdmin.id)?.role).toBe("admin");
    updateUser(onlyAdmin.id, { role: "staff" });
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
    updateUser(first.id, { role: "staff" });
  });

  it("still lets the only active admin demote an inactive admin", async () => {
    const active = createUser("active-admin", { role: "admin" });
    const inactive = createUser("inactive-admin", { role: "admin", isActive: 0 });

    const res = await patchUser(active, inactive.id, { role: "staff" });

    expect(res.status).toBe(200);
    expect(getUser(inactive.id)?.role).toBe("staff");
    updateUser(active.id, { role: "staff" });
  });
});
