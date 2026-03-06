import { NextRequest, NextResponse } from "next/server";
import { uploadObject } from "@/lib/spaces/storage";
import { verifySession, getAuthSecret } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth helper — reuses the existing session cookie
// ---------------------------------------------------------------------------
async function requireAuth(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    return await verifySession(token, getAuthSecret());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Timestamp for unique key suffix:  20260301-143022
// ---------------------------------------------------------------------------
function keyTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/-|:|T/g, "")
    .slice(0, 15)
    .replace(/(\d{8})(\d{6})/, "$1-$2");
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function ensureImportBatchesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS public.bank_import_batches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      row_count int NOT NULL DEFAULT 0,
      processed_count int NOT NULL DEFAULT 0,
      error_count int NOT NULL DEFAULT 0,
      error_message text,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by text,
      started_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
}

// ---------------------------------------------------------------------------
// POST /api/bank-imports/upload
//
// Body:   multipart/form-data, field name: "file"
// Query:  ?propertyId=xxx  &period=2026-03
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") ?? "default";
  const period = url.searchParams.get("period") ?? "unknown";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to parse multipart form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file uploaded (field name: file)" }, { status: 400 });
  }

  // Validate: extension or MIME
  const nameLower = file.name.toLowerCase();
  const mimeOk = file.type === "text/csv" || file.type === "text/plain" || file.type === "application/vnd.ms-excel";
  if (!nameLower.endsWith(".csv") && !mimeOk) {
    return NextResponse.json({ ok: false, error: "Only .csv files are accepted" }, { status: 400 });
  }

  // Validate: size
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File exceeds 10 MB limit (got ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 },
    );
  }

  const key = `bank-imports/${propertyId}/${period}/${keyTimestamp()}-${file.name}`;
  const body = Buffer.from(await file.arrayBuffer());

  console.log(`[bank-imports/upload] started key=${key} size=${file.size} user=${session.sub}`);

  try {
    await uploadObject({ key, body, contentType: "text/csv" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[bank-imports/upload] failed key=${key}`, msg);
    return NextResponse.json({ ok: false, error: `Upload to Spaces failed: ${msg}` }, { status: 502 });
  }

  await ensureImportBatchesTable();
  const batchRes = await query<{ id: string }>(
    `INSERT INTO public.bank_import_batches (source, status, row_count, processed_count, error_count, meta, created_by)
     VALUES ($1, 'pending', 0, 0, 0, $2::jsonb, $3)
     RETURNING id`,
    [
      "bank-imports/upload",
      JSON.stringify({
        key,
        file_name: file.name,
        file_size: file.size,
        property_id: propertyId,
        period,
      }),
      session.sub,
    ],
  );
  const batchId = String(batchRes.rows[0]?.id || "");

  console.log(`[bank-imports/upload] completed key=${key}`);
  return NextResponse.json({ ok: true, key, size: file.size, batchId });
}
