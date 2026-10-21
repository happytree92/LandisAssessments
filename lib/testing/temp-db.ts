/**
 * Test helpers for code that reads the real database. Each test file that
 * calls useTempDatabase() gets its own fresh SQLite file in a temp folder,
 * created, migrated and seeded (default admin, built-in templates) the same way
 * the app does it on first start.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { runSeed } from "@/lib/db/seed";

/** Call in beforeAll, before anything touches `db`. Returns a cleanup for afterAll. */
export async function useTempDatabase(): Promise<() => void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "landis-test-"));
  process.env.DATABASE_URL = path.join(dir, "test.db");
  (globalThis as { db?: unknown }).db = undefined;

  // The first query creates the schema and starts seeding in the background.
  // Awaiting a second seed run (it's idempotent) means the admin exists after this.
  await runSeed(db);

  return () => {
    // drizzle exposes the better-sqlite3 handle as $client; lib/db's DB type omits it
    (db as unknown as { $client: { close(): void } }).$client.close();
    (globalThis as { db?: unknown }).db = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  };
}

export function createUser(
  username: string,
  fields: Partial<Pick<User, "role" | "isActive" | "passwordChangedAt">> = {}
): User {
  return db
    .insert(users)
    .values({
      username,
      displayName: username,
      passwordHash: "not-used-in-tests",
      role: fields.role ?? "staff",
      isActive: fields.isActive ?? 1,
      passwordChangedAt: fields.passwordChangedAt ?? null,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .returning()
    .get();
}

export function updateUser(id: number, fields: Partial<User>): void {
  db.update(users).set(fields).where(eq(users.id, id)).run();
}

/** Makes every admin (the seeded default one included) staff, for tests that count admins. */
export function demoteAllAdmins(): void {
  db.update(users).set({ role: "staff" }).where(eq(users.role, "admin")).run();
}

export function getUser(id: number): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** A session cookie value for `user` as it is right now, as login would issue it. */
export function sessionTokenFor(user: User): Promise<string> {
  return signToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    pwdAt: user.passwordChangedAt ?? undefined,
  });
}
