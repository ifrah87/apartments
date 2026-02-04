import { NextRequest, NextResponse } from "next/server";
import { tenantsRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "JSON payload required. CSV imports must use the dev-only script." },
        { status: 415 },
      );
    }

    const body = await req.json();
    const rawRows = Array.isArray(body)
      ? body
      : Array.isArray(body?.rows)
        ? body.rows
        : Array.isArray(body?.tenants)
          ? body.tenants
          : [];

    if (!rawRows.length) {
      return NextResponse.json({ ok: false, error: "No tenant rows provided." }, { status: 400 });
    }

    const rows = (rawRows as any[])
      .filter(Boolean)
      .map((row) => ({
        id: row.id ?? row.reference,
        name: row.name,
        building: row.building,
        property_id: row.property_id,
        unit: row.unit,
        monthly_rent: row.monthly_rent,
        due_day: row.due_day,
        reference: row.reference,
      }))
      .filter((row) => row.id && row.name);

    const result = await tenantsRepo.upsertTenants(rows);

    return NextResponse.json({
      ok: true,
      data: {
        inserted: result.inserted,
        updated: result.updated,
        total: rows.length,
      },
    });
  } catch (err) {
    console.error("❌ /api/import/tenants failed:", err);
    return handleError(err);
  }
}
