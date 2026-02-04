import { NextResponse } from "next/server";
import { getAuthSecret, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!match) return NextResponse.json({ authenticated: false });
  const token = decodeURIComponent(match[1]);
  const session = await verifySession(token, getAuthSecret());
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    phone: session.phone,
    role: session.role,
  });
}
