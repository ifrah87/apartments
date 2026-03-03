import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getAuthSecret, signSession } from "@/lib/auth";
import { clockInUser } from "@/lib/staffAttendance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password are required." }, { status: 400 });
    }

    const nameColumn = await query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'name'
       LIMIT 1`,
    );
    const hasName = nameColumn.rows.length > 0;

    const result = hasName
      ? await query<{
          id: string;
          name: string | null;
          phone: string;
          password_hash: string;
          role: "admin" | "reception";
        }>("SELECT id, name, phone, password_hash, role FROM users WHERE phone = $1 LIMIT 1", [phone])
      : await query<{
          id: string;
          phone: string;
          password_hash: string;
          role: "admin" | "reception";
        }>("SELECT id, phone, password_hash, role FROM users WHERE phone = $1 LIMIT 1", [phone]);

    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    await clockInUser({
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: "name" in user ? (user as { name: string | null }).name : null,
    });

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
