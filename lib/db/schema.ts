import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Staff user accounts
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("staff"),    // "admin" | "staff"
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at"), // unix timestamp
});

// MSP clients
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// One record per completed assessment
export const assessments = sqliteTable("assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  conductedBy: integer("conducted_by")
    .notNull()
    .references(() => users.id),
  templateId: text("template_id").notNull(), // "security" | "onboarding"
  answers: text("answers").notNull(), // JSON: { questionId: { answer, notes? } }
  overallScore: integer("overall_score").notNull(), // 0–100
  categoryScores: text("category_scores").notNull(), // JSON: { categoryName: score }
  source: text("source").default("staff"),           // "staff" | "customer_link"
  completedAt: integer("completed_at"),
  createdAt: integer("created_at"),
});

// Assessment templates (security / onboarding)
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").unique().notNull(),       // "security" | "onboarding"
  name: text("name").notNull(),                // "Security Assessment"
  description: text("description"),
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at"),
});

// Individual questions belonging to a template
export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateId: integer("template_id")
    .notNull()
    .references(() => templates.id),
  category: text("category").notNull(),
  text: text("text").notNull(),
  weight: integer("weight").notNull(),         // 1–10
  yesScore: integer("yes_score").notNull(),    // 0–100
  noScore: integer("no_score").notNull(),      // 0–100
  maybeScore: integer("maybe_score").notNull(), // 0–100
  sortOrder: integer("sort_order").default(0),
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at"),
});

// App-level key/value settings (branding colors, etc.)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at"),
});

// One-time shareable links for customer self-assessments
export const assessmentTokens = sqliteTable("assessment_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").unique().notNull(),           // crypto.randomUUID()
  customerId: integer("customer_id").notNull().references(() => customers.id),
  templateId: text("template_id").notNull(),         // slug: "security" | "onboarding"
  createdBy: integer("created_by").notNull().references(() => users.id),
  expiresAt: integer("expires_at").notNull(),        // unix timestamp
  usedAt: integer("used_at"),                        // null until submitted
  submittedFromIp: text("submitted_from_ip"),
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at"),
});

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type DbQuestion = typeof questions.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type AssessmentToken = typeof assessmentTokens.$inferSelect;
