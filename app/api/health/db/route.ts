import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const r = await query("select now() as now");
    return NextResponse.json({ ok: true, now: r.rows[0].now });
  } catch {
    return NextResponse.json(
      { ok: false, error: isProduction ? "Service unavailable" : "Database health check failed" },
      { status: 500 },
    );
  }
}
