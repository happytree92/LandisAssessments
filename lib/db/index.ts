import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { runSeed } from "./seed";

// Safely add a column to an existing table — no-op if it already exists
function addColumnIfMissing(sqlite: { exec: (sql: string) => void }, table: string, column: string, definition: string) {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists — ignore
  }
}

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

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS assessment_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      template_id TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      submitted_from_ip TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id INTEGER,
      username TEXT,
      ip_address TEXT,
      resource_type TEXT,
      resource_id INTEGER,
      metadata TEXT
    );
  `);

  // Schema migrations — add new columns to existing tables without dropping data
  addColumnIfMissing(sqlite, "users", "role", "TEXT NOT NULL DEFAULT 'staff'");
  addColumnIfMissing(sqlite, "users", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing(sqlite, "users", "mfa_secret", "TEXT");
  addColumnIfMissing(sqlite, "users", "mfa_enabled", "INTEGER DEFAULT 0");
  addColumnIfMissing(sqlite, "users", "mfa_enforced", "INTEGER DEFAULT 0");
  addColumnIfMissing(sqlite, "users", "email", "TEXT");
  addColumnIfMissing(sqlite, "users", "sso_provider", "TEXT");
  addColumnIfMissing(sqlite, "users", "external_id", "TEXT");
  addColumnIfMissing(sqlite, "assessments", "source", "TEXT DEFAULT 'staff'");
  addColumnIfMissing(sqlite, "templates", "deleted_at", "INTEGER");

  // Migration: make assessments.conducted_by nullable to support user deletion
  // SQLite doesn't support ALTER COLUMN, so we rebuild the table if needed.
  try {
    type ColInfo = { name: string; notnull: number };
    const assessmentCols = sqlite.prepare("PRAGMA table_info(assessments)").all() as ColInfo[];
    const conductedByCol = assessmentCols.find(c => c.name === "conducted_by");
    if (conductedByCol && conductedByCol.notnull === 1) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE assessments_nullable_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          conducted_by INTEGER REFERENCES users(id),
          template_id TEXT NOT NULL,
          answers TEXT NOT NULL,
          overall_score INTEGER NOT NULL,
          category_scores TEXT NOT NULL,
          source TEXT DEFAULT 'staff',
          completed_at INTEGER,
          created_at INTEGER
        );
        INSERT INTO assessments_nullable_migration
          SELECT id, customer_id, conducted_by, template_id, answers, overall_score,
                 category_scores, source, completed_at, created_at
          FROM assessments;
        DROP TABLE assessments;
        ALTER TABLE assessments_nullable_migration RENAME TO assessments;
        PRAGMA foreign_keys = ON;
      `);
      // Fix the AUTOINCREMENT sequence table after the rename
      try {
        sqlite.prepare(
          `UPDATE sqlite_sequence SET name='assessments' WHERE name='assessments_nullable_migration'`
        ).run();
      } catch { /* table may be empty — no entry to fix */ }
    }
  } catch (err) {
    console.error("[db migration] assessments.conducted_by nullable:", err);
  }

  // Migration: make assessment_tokens.created_by nullable to support user deletion
  try {
    type ColInfo = { name: string; notnull: number };
    const tokenCols = sqlite.prepare("PRAGMA table_info(assessment_tokens)").all() as ColInfo[];
    const createdByCol = tokenCols.find(c => c.name === "created_by");
    if (createdByCol && createdByCol.notnull === 1) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE assessment_tokens_nullable_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          template_id TEXT NOT NULL,
          created_by INTEGER REFERENCES users(id),
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          submitted_from_ip TEXT,
          is_active INTEGER DEFAULT 1,
          created_at INTEGER
        );
        INSERT INTO assessment_tokens_nullable_migration
          SELECT id, token, customer_id, template_id, created_by, expires_at,
                 used_at, submitted_from_ip, is_active, created_at
          FROM assessment_tokens;
        DROP TABLE assessment_tokens;
        ALTER TABLE assessment_tokens_nullable_migration RENAME TO assessment_tokens;
        PRAGMA foreign_keys = ON;
      `);
      try {
        sqlite.prepare(
          `UPDATE sqlite_sequence SET name='assessment_tokens' WHERE name='assessment_tokens_nullable_migration'`
        ).run();
      } catch { /* no sequence entry to fix */ }
    }
  } catch (err) {
    console.error("[db migration] assessment_tokens.created_by nullable:", err);
  }

  const db = drizzle(sqlite, { schema });

  const nowSec = Math.floor(Date.now() / 1000);

  // Expire tokens where expiresAt < now and isActive = 1
  try {
    sqlite.exec(
      `UPDATE assessment_tokens SET is_active = 0 WHERE expires_at < ${nowSec} AND is_active = 1`
    );
  } catch {
    // Safe to ignore if table doesn't exist yet
  }

  // Retention: delete logs older than the configured period, then log the cleanup
  try {
    let retentionDays = 90;
    try {
      const retentionRow = sqlite.prepare(
        `SELECT value FROM settings WHERE key = 'log_retention_days'`
      ).get() as { value: string } | undefined;
      if (retentionRow) {
        const parsed = parseInt(retentionRow.value, 10);
        if ([30, 90, 365].includes(parsed)) retentionDays = parsed;
      }
    } catch { /* settings table may not exist yet — use default */ }

    const retentionCutoff = nowSec - retentionDays * 24 * 60 * 60;
    const deleted = sqlite.prepare(
      `DELETE FROM activity_logs WHERE timestamp < ? RETURNING id`
    ).all(retentionCutoff) as { id: number }[];
    if (deleted.length > 0) {
      sqlite.prepare(
        `INSERT INTO activity_logs (timestamp, level, category, action, metadata) VALUES (?, 'info', 'system', 'system.log_retention', ?)`
      ).run(nowSec, JSON.stringify({ deletedCount: deleted.length, retentionDays }));
    }
  } catch {
    // Safe to ignore on first run
  }

  // Log app startup
  try {
    sqlite.prepare(
      `INSERT INTO activity_logs (timestamp, level, category, action, metadata) VALUES (?, 'info', 'system', 'system.startup', ?)`
    ).run(nowSec, JSON.stringify({ nodeEnv: process.env.NODE_ENV ?? "development" }));
  } catch {
    // Safe to ignore
  }

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
