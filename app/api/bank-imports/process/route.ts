import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { parse as csvParse } from "papaparse";
import { downloadObject } from "@/lib/spaces/storage";
import { query } from "@/lib/db";
import { verifySession, getAuthSecret } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth
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
// CSV header normalisation
// Maps whatever the bank calls the column → our canonical field name
// ---------------------------------------------------------------------------
const HEADER_MAP: Record<string, string> = {
  // date
  date:               "date",
  "transaction date": "date",
  "posted date":      "date",
  trandate:           "date",
  // amount (single-column)
  amount:             "amount",
  // debit / credit (two-column — amount = credit - debit)
  debit:              "debit",
  withdrawal:         "debit",
  credit:             "credit",
  deposit:            "credit",
  // payee
  payee:              "payee",
  name:               "payee",
  merchant:           "payee",
  // description
  description:        "description",
  details:            "description",
  memo:               "description",
  particulars:        "description",
  // reference
  ref:                "reference",
  reference:          "reference",
  "transaction id":   "reference",
  tran_no:            "reference",
};

function normaliseHeader(h: string): string {
  return HEADER_MAP[h.trim().toLowerCase()] ?? h.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Salaam Bank PARTICULARS parser  →  { payee, description, reference }
// #EX:1#Rent#From: QAALI DAUD ELMI(_009)#REF:35462306
// ---------------------------------------------------------------------------
function parseParticulars(raw: string) {
  const description = raw.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? raw.trim();
  const payee       = raw.match(/#From:\s*(.+?)\s*\(/)?.[1]?.trim() ?? null;
  const reference   = raw.match(/#REF:(\S+)/)?.[1] ?? null;
  return { description, payee, reference };
}

// ---------------------------------------------------------------------------
// Parse DD/MM/YYYY  or  YYYY-MM-DD  →  YYYY-MM-DD
// ---------------------------------------------------------------------------
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v).replace(/,/g, "")) || 0;
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------
function fingerprint(date: string, amount: number, payee: string, reference: string | null, description: string): string {
  return crypto
    .createHash("sha256")
    .update(`${date}|${amount.toFixed(2)}|${payee}|${reference ?? ""}|${description}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Normalised transaction
// ---------------------------------------------------------------------------
type NormalisedTxn = {
  date: string;
  amount: number;
  payee: string;
  description: string;
  reference: string | null;
  fingerprint: string;
};

function normaliseRows(rows: Record<string, string>[]): { txns: NormalisedTxn[]; skippedParse: number } {
  let skippedParse = 0;
  const txns: NormalisedTxn[] = [];

  for (const raw of rows) {
    // Remap headers
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      row[normaliseHeader(k)] = String(v ?? "");
    }

    // ── Date ────────────────────────────────────────────────────────────────
    const date = parseDate(row["date"] ?? "");
    if (!date) { skippedParse++; continue; }

    // ── Amount ──────────────────────────────────────────────────────────────
    let amount: number;
    if (row["amount"] !== undefined) {
      amount = toNum(row["amount"]);
    } else {
      // Debit/Credit columns  (credit - debit → positive = inflow)
      amount = toNum(row["credit"]) - toNum(row["debit"]);
    }

    // ── Payee / Description / Reference ─────────────────────────────────────
    // Salaam Bank PARTICULARS field gets special treatment
    let payee = (row["payee"] ?? "").trim();
    let description = (row["description"] ?? row["particulars"] ?? "").trim();
    let reference: string | null = row["reference"]?.trim() || null;

    if (!payee && description.startsWith("#EX:")) {
      const parsed = parseParticulars(description);
      payee       = parsed.payee ?? payee;
      description = parsed.description;
      reference   = reference ?? parsed.reference;
    }

    if (!payee) payee = description || "Unknown";

    txns.push({
      date,
      amount,
      payee,
      description,
      reference,
      fingerprint: fingerprint(date, amount, payee, reference, description),
    });
  }

  return { txns, skippedParse };
}

// ---------------------------------------------------------------------------
// POST /api/bank-imports/process
//
// Body JSON:  { key: string }   — Spaces object key returned by /upload
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await ensureImportBatchesTable();

  let key: string | undefined;
  let batchId: string | undefined;
  let retry = false;
  try {
    const body = await req.json();
    key = body?.key;
    batchId = body?.batchId;
    retry = body?.retry === true;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON { key?: string, batchId?: string }" }, { status: 400 });
  }
  if ((!key || typeof key !== "string") && batchId) {
    const batchRes = await query<{ id: string; meta: Record<string, unknown> | null; status: string | null }>(
      `SELECT id, meta, status
       FROM public.bank_import_batches
       WHERE id = $1
       LIMIT 1`,
      [batchId],
    );
    const batch = batchRes.rows[0];
    if (!batch) {
      return NextResponse.json({ ok: false, error: "Batch not found." }, { status: 404 });
    }
    const batchKey = typeof batch.meta?.key === "string" ? batch.meta.key : "";
    if (!batchKey) {
      return NextResponse.json({ ok: false, error: "Batch has no source key." }, { status: 400 });
    }
    if (!retry && String(batch.status || "").toLowerCase() === "completed") {
      return NextResponse.json({ ok: false, error: "Batch already completed. Use retry=true to reprocess." }, { status: 409 });
    }
    key = batchKey;
  }
  if (!key || typeof key !== "string") {
    return NextResponse.json({ ok: false, error: "key or batchId is required" }, { status: 400 });
  }

  if (!batchId) {
    const createdBatch = await query<{ id: string }>(
      `INSERT INTO public.bank_import_batches (source, status, row_count, processed_count, error_count, meta, created_by)
       VALUES ($1, 'pending', 0, 0, 0, $2::jsonb, $3)
       RETURNING id`,
      ["bank-imports/process", JSON.stringify({ key }), session.sub],
    );
    batchId = String(createdBatch.rows[0]?.id || "");
  }
  await query(
    `UPDATE public.bank_import_batches
     SET status = 'processing',
         started_at = now(),
         completed_at = NULL,
         error_message = NULL,
         updated_at = now()
     WHERE id = $1`,
    [batchId],
  );

  // ── 1. Download from Spaces ──────────────────────────────────────────────
  console.log(`[bank-imports/process] downloading key=${key}`);
  let csvBuffer: Buffer;
  try {
    csvBuffer = await downloadObject({ key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[bank-imports/process] download failed key=${key}`, msg);
    await query(
      `UPDATE public.bank_import_batches
       SET status = 'failed',
           error_message = $2,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [batchId, msg],
    ).catch(() => {});
    return NextResponse.json({ ok: false, error: `Could not download file: ${msg}`, batchId }, { status: 502 });
  }
  console.log(`[bank-imports/process] download ok bytes=${csvBuffer.length}`);

  // ── 2. Parse CSV ─────────────────────────────────────────────────────────
  const { data: rawRows, errors } = csvParse(csvBuffer.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  }) as { data: Record<string, string>[]; errors: Array<{ message: string }> };

  if (errors.length) {
    console.warn(`[bank-imports/process] CSV warnings:`, errors.map((e) => e.message));
  }
  console.log(`[bank-imports/process] parsed rows=${rawRows.length}`);

  // ── 3. Normalise ──────────────────────────────────────────────────────────
  const { txns, skippedParse } = normaliseRows(rawRows);
  console.log(`[bank-imports/process] normalised txns=${txns.length} skipped_parse=${skippedParse}`);

  if (!txns.length) {
    await query(
      `UPDATE public.bank_import_batches
       SET status = 'completed',
           row_count = $2,
           processed_count = 0,
           error_count = $3,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [batchId, rawRows.length, skippedParse],
    );
    return NextResponse.json({
      ok: true,
      batchId,
      status: "completed",
      row_count: rawRows.length,
      processed_count: 0,
      error_count: skippedParse,
      inserted: 0,
      skipped_duplicates: 0,
      skipped_parse: skippedParse,
      message: "No valid rows found in file.",
    });
  }

  // ── 4. Insert into bank_transactions (dedupe via fingerprint) ─────────────
  let inserted = 0;
  let skippedDuplicates = 0;

  for (const txn of txns) {
    const deposit    = txn.amount > 0 ? txn.amount : 0;
    const withdrawal = txn.amount < 0 ? Math.abs(txn.amount) : 0;

    const result = await query(
      `INSERT INTO public.bank_transactions
         (txn_date, particulars, payee, ref, deposit, withdrawal,
          fingerprint, source_bank, source_key, status, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNREVIEWED', 'SUSPENSE')
       ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
       DO NOTHING`,
      [
        txn.date,
        txn.description,
        txn.payee,
        txn.reference,
        deposit,
        withdrawal,
        txn.fingerprint,
        "spaces-import",
        key,
      ],
    );

    if (result.rowCount && result.rowCount > 0) {
      inserted++;
    } else {
      skippedDuplicates++;
    }
  }

  console.log(`[bank-imports/process] done inserted=${inserted} skipped_duplicates=${skippedDuplicates} key=${key}`);

  const processedCount = inserted + skippedDuplicates;
  await query(
    `UPDATE public.bank_import_batches
     SET status = 'completed',
         row_count = $2,
         processed_count = $3,
         error_count = $4,
         error_message = NULL,
         completed_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [batchId, rawRows.length, processedCount, skippedParse],
  );

  return NextResponse.json({
    ok: true,
    batchId,
    status: "completed",
    row_count: rawRows.length,
    processed_count: processedCount,
    error_count: skippedParse,
    inserted,
    skipped_duplicates: skippedDuplicates,
    skipped_parse: skippedParse,
  });
}
