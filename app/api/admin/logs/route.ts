import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, like, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/logs — admin only, paginated activity log query
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await verifyToken(sessionCookie);
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category") ?? undefined;
    const level = searchParams.get("level") ?? undefined;
    const userIdParam = searchParams.get("userId");
    const username = searchParams.get("username") ?? undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = (page - 1) * limit;

    // Build filter conditions
    const conditions = [];
    if (category) conditions.push(eq(activityLogs.category, category));
    if (level) conditions.push(eq(activityLogs.level, level));
    if (userIdParam) {
      const uid = parseInt(userIdParam, 10);
      if (!isNaN(uid)) conditions.push(eq(activityLogs.userId, uid));
    }
    if (username) conditions.push(like(activityLogs.username, `%${username}%`));
    if (fromParam) {
      const fromUnix = Math.floor(new Date(`${fromParam}T00:00:00Z`).getTime() / 1000);
      if (!isNaN(fromUnix)) conditions.push(gte(activityLogs.timestamp, fromUnix));
    }
    if (toParam) {
      const toUnix = Math.floor(new Date(`${toParam}T23:59:59Z`).getTime() / 1000);
      if (!isNaN(toUnix)) conditions.push(lte(activityLogs.timestamp, toUnix));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = db
      .select({ total: sql<number>`count(*)` })
      .from(activityLogs)
      .where(where)
      .get();
    const total = countResult?.total ?? 0;

    const rows = db
      .select()
      .from(activityLogs)
      .where(where)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({
      logs: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
