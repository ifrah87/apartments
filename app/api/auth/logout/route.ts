import { NextResponse } from "next/server";
import { clockOutUser } from "@/lib/staffAttendance";
import { getAuthSecret, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    const session = await verifySession(token, getAuthSecret()).catch(() => null);
    if (session?.sub) {
      await clockOutUser(session.sub).catch((error) => {
        console.error("Failed to record staff clock-out", error);
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
