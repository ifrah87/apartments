import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getAuthSecret, signSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password are required." }, { status: 400 });
    }

    const result = await query<{
      id: string;
      phone: string;
      password_hash: string;
      role: "admin" | "reception";
    }>("SELECT id, phone, password_hash, role FROM users WHERE phone = $1 LIMIT 1", [phone]);

    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const session = await signSession(
      {
        sub: user.id,
        role: user.role,
        phone: user.phone,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      },
      getAuthSecret()
    );

    const response = NextResponse.json({ ok: true, role: user.role });
    response.cookies.set("session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
