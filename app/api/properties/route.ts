import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function handleError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "1";
    const where = includeArchived ? "" : "WHERE status <> 'archived'";
    const { rows } = await query(
      `SELECT id, name, code, address, city, country, status, created_at
       FROM public.properties
       ${where}
       ORDER BY created_at DESC`,
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    console.error("❌ /api/properties failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const name = String(payload?.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }
    const code = payload?.code ? String(payload.code).trim() : null;
    const address = payload?.address ? String(payload.address).trim() : null;
    const city = payload?.city ? String(payload.city).trim() : null;
    const country = payload?.country ? String(payload.country).trim() : null;

    const { rows } = await query(
      `INSERT INTO public.properties (name, code, address, city, country)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, code, address, city, country, status, created_at`,
      [name, code, address, city, country],
    );
    return NextResponse.json({ ok: true, data: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/properties POST failed:", err);
    return handleError(err);
  }
}
