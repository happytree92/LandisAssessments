import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
