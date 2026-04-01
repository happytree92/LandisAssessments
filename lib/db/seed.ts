import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "changeme123";

export async function runSeed(
  db: BetterSQLite3Database<typeof schema>
): Promise<void> {
  const existing = db.select().from(schema.users).all();

  if (existing.length > 0) {
    // Users exist — check if default password is still in use
    const adminUser = existing.find((u) => u.username === DEFAULT_USERNAME);
    if (adminUser) {
      const isDefault = await bcrypt.compare(
        DEFAULT_PASSWORD,
        adminUser.passwordHash
      );
      if (isDefault) {
        console.warn(
          "⚠️  WARNING: The default admin password has not been changed. " +
            "Please update it immediately."
        );
      }
    }
    return;
  }

  // Seed default admin user
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  // Use onConflictDoNothing to safely handle concurrent worker startup
  db.insert(schema.users)
    .values({
      username: DEFAULT_USERNAME,
      passwordHash,
      displayName: "Admin",
      createdAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoNothing()
    .run();

  console.warn(
    "⚠️  WARNING: Default admin user created (admin / changeme123). " +
      "Change this password immediately."
  );
}
