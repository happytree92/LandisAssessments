import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get("session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = await getSession(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        userId: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
