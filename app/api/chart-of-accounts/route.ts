import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT code, name, category, sub_type, sort_order, active
       FROM public.chart_of_accounts
       ORDER BY sort_order ASC, code ASC`,
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load chart of accounts";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST — create new account
export async function POST(req: NextRequest) {
  try {
    const { code, name, category, sub_type, sort_order } = await req.json();
    if (!code || !name || !category) {
      return NextResponse.json({ ok: false, error: "code, name, category required" }, { status: 400 });
    }
    await query(
      `INSERT INTO public.chart_of_accounts (code, name, category, sub_type, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [code.trim(), name.trim(), category.toUpperCase(), (sub_type ?? "").trim(), sort_order ?? 999],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// PATCH — update name / sub_type / active
export async function PATCH(req: NextRequest) {
  try {
    const { code, name, sub_type, active } = await req.json();
    if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    await query(
      `UPDATE public.chart_of_accounts
       SET name=$1, sub_type=$2, active=$3
       WHERE code=$4`,
      [name.trim(), (sub_type ?? "").trim(), active ?? true, code],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update account";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// DELETE — permanently remove an account
export async function DELETE(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    await query(`DELETE FROM public.chart_of_accounts WHERE code = $1`, [code]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete account";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
