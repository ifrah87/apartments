import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export async function GET() {
  try {
    const r = await query("select now() as now");
    return NextResponse.json({ ok: true, now: r.rows[0].now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
