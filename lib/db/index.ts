import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { runSeed } from "./seed";

// Prevent multiple DB connections during Next.js dev hot-reload
const globalForDb = global as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function createDb(): ReturnType<typeof drizzle<typeof schema>> {
  const dbUrl = process.env.DATABASE_URL ?? "./data/assessments.db";
  const dbPath = path.resolve(dbUrl);

  // Auto-create the data directory if it doesn't exist
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);

  // WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create tables on first run (no migration runner needed for this scale)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      notes TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      conducted_by INTEGER NOT NULL REFERENCES users(id),
      template_id TEXT NOT NULL,
      answers TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      category_scores TEXT NOT NULL,
      completed_at INTEGER,
      created_at INTEGER
    );
  `);

  const db = drizzle(sqlite, { schema });

  // Seed default admin if users table is empty
  runSeed(db).catch((err) => {
    console.error("DB seed error:", err);
  });

  return db;
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
