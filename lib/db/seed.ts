import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { securityQuestions, onboardingQuestions } from "../questions";

const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "changeme123";

export async function runSeed(
  db: BetterSQLite3Database<typeof schema>
): Promise<void> {
  await seedUsers(db);
  await seedTemplatesAndQuestions(db);
}

async function seedUsers(
  db: BetterSQLite3Database<typeof schema>
): Promise<void> {
  const existing = db.select().from(schema.users).all();

  if (existing.length > 0) {
    const adminUser = existing.find((u) => u.username === DEFAULT_USERNAME);
    if (adminUser) {
      const isDefault = await bcrypt.compare(DEFAULT_PASSWORD, adminUser.passwordHash);
      if (isDefault) {
        console.warn(
          "⚠️  WARNING: The default admin password has not been changed. " +
            "Please update it immediately."
        );
      }
      // Ensure the default admin user has role = "admin" (handles existing DBs)
      if (adminUser.role !== "admin") {
        db.update(schema.users)
          .set({ role: "admin" })
          .where(eq(schema.users.id, adminUser.id))
          .run();
      }
    }
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  db.insert(schema.users)
    .values({
      username: DEFAULT_USERNAME,
      passwordHash,
      displayName: "Admin",
      role: "admin",
      isActive: 1,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoNothing()
    .run();

  console.warn(
    "⚠️  WARNING: Default admin user created (admin / changeme123). " +
      "Change this password immediately."
  );
}

async function seedTemplatesAndQuestions(
  db: BetterSQLite3Database<typeof schema>
): Promise<void> {
  const existingTemplates = db.select().from(schema.templates).all();
  if (existingTemplates.length > 0) return;

  const now = Math.floor(Date.now() / 1000);

  const securityTemplate = db
    .insert(schema.templates)
    .values({
      slug: "security",
      name: "Security Assessment",
      description: "Comprehensive IT security assessment for SMB clients",
      isActive: 1,
      createdAt: now,
    })
    .returning()
    .get();

  const onboardingTemplate = db
    .insert(schema.templates)
    .values({
      slug: "onboarding",
      name: "New Customer Onboarding",
      description: "Onboarding checklist for new MSP clients",
      isActive: 1,
      createdAt: now,
    })
    .returning()
    .get();

  for (let i = 0; i < securityQuestions.length; i++) {
    const q = securityQuestions[i];
    db.insert(schema.questions)
      .values({
        templateId: securityTemplate.id,
        category: q.category,
        text: q.text,
        weight: q.weight,
        yesScore: q.scores.Yes,
        noScore: q.scores.No,
        maybeScore: q.scores.Maybe,
        sortOrder: i,
        isActive: 1,
        createdAt: now,
      })
      .run();
  }

  for (let i = 0; i < onboardingQuestions.length; i++) {
    const q = onboardingQuestions[i];
    db.insert(schema.questions)
      .values({
        templateId: onboardingTemplate.id,
        category: q.category,
        text: q.text,
        weight: q.weight,
        yesScore: q.scores.Yes,
        noScore: q.scores.No,
        maybeScore: q.scores.Maybe,
        sortOrder: i,
        isActive: 1,
        createdAt: now,
      })
      .run();
  }

  console.log(
    `[seed] Templates and questions seeded: ${securityQuestions.length} security, ${onboardingQuestions.length} onboarding`
  );
}
