import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";

const VALID_RETENTION_DAYS = [30, 90, 365] as const;
export type RetentionDays = (typeof VALID_RETENTION_DAYS)[number];

/** Parse the raw settings value into a valid retention period. Defaults to 90. */
export function parseRetentionDays(raw: string | undefined): RetentionDays {
  const n = parseInt(raw ?? "", 10);
  return (VALID_RETENTION_DAYS as readonly number[]).includes(n)
    ? (n as RetentionDays)
    : 90;
}

/** Delete log entries older than `retentionDays` days. Returns the number of rows deleted. */
export function purgeOldLogs(retentionDays: number): number {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const result = db.delete(activityLogs).where(lt(activityLogs.timestamp, cutoff)).run();
  return result.changes;
}
