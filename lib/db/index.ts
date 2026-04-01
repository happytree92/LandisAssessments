import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { runSeed } from "./seed";

type DB = BetterSQLite3Database<typeof schema>;

// Prevent multiple DB connections during Next.js dev hot-reload
const globalForDb = global as unknown as { db: DB | undefined };

function createDb(): DB {
  // Use require() instead of a top-level import so the native .node binary
  // is only loaded when this function runs (at request time), not when the
  // module is imported during Next.js build-time analysis. Turbopack in
  // Next.js 16 evaluates modules at build time, which would call dlopen on
  // the wrong-platform binary inside Docker multi-platform builds.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");

  const dbUrl = process.env.DATABASE_URL ?? "./data/assessments.db";
  const dbPath = path.resolve(dbUrl);

  // Auto-create the data directory if it doesn't exist
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // CJS require returns the constructor directly (not under .default)
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

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES templates(id),
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      weight INTEGER NOT NULL,
      yes_score INTEGER NOT NULL,
      no_score INTEGER NOT NULL,
      maybe_score INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER
    );
  `);

  const db = drizzle(sqlite, { schema });

  // Seed default admin if users table is empty
  runSeed(db).catch((err) => {
    console.error("[db] Seed error:", err);
  });

  return db;
}

function getOrCreateDb(): DB {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

// Export a Proxy so the module can be imported without touching the DB.
// The real connection is created only when the first property is accessed
// (i.e., when an actual route handler runs), not at module evaluation time.
export const db = new Proxy({} as DB, {
  get(_target, prop: string | symbol) {
    const realDb = getOrCreateDb();
    const value = (realDb as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
