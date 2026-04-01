/**
 * Activity logger — fire-and-forget, never throws.
 * Never log passwords or raw token values.
 */

import { db } from "./db";
import { activityLogs } from "./db/schema";

type LogLevel = "info" | "warn" | "error";
type LogCategory =
  | "auth"
  | "assessment"
  | "customer"
  | "user"
  | "token"
  | "system"
  | "access";

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  action: string;
  userId?: number;
  username?: string;
  ipAddress?: string;
  resourceType?: string;
  resourceId?: number;
  metadata?: Record<string, unknown>;
}

export function log(entry: LogEntry): void {
  try {
    db.insert(activityLogs)
      .values({
        timestamp: Math.floor(Date.now() / 1000),
        level: entry.level,
        category: entry.category,
        action: entry.action,
        userId: entry.userId ?? null,
        username: entry.username ?? null,
        ipAddress: entry.ipAddress ?? null,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      })
      .run();
  } catch {
    // Never propagate logger errors — logging must never break the app
  }
}
