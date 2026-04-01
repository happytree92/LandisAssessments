import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Staff user accounts
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
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
  completedAt: integer("completed_at"),
  createdAt: integer("created_at"),
});

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
