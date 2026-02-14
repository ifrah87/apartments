import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/client";

type BookmarkletTransaction = {
  date: string;
  ref?: string | null;
  branch?: string | null;
  particulars?: string | null;
  chequeNo?: string | null;
  withdrawal?: number | string | null;
  deposit?: number | string | null;
  balance?: number | string | null;
};

type BookmarkletPayload = {
  source?: string;
  pageUrl?: string;
  account?: string;
  transactions?: BookmarkletTransaction[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.BOOKMARKLET_CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    let payload: BookmarkletPayload;
    try {
      payload = (await req.json()) as BookmarkletPayload;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON payload." }, 400);
    }

    const transactions = payload?.transactions;
    if (!Array.isArray(transactions)) {
      return jsonResponse({ ok: false, error: "Expected transactions array." }, 400);
    }

    const normalized = transactions.map((txn, index) => {
      if (!txn || typeof txn !== "object") {
        throw new Error(`Transaction at index ${index} is invalid.`);
      }
      const date = normalizeText(txn.date);
      if (!date) {
        throw new Error(`Transaction at index ${index} is missing date.`);
      }

      return {
        txn_date: date,
        ref: normalizeText(txn.ref),
        branch: normalizeText(txn.branch),
        particulars: normalizeText(txn.particulars),
        cheque_no: normalizeText(txn.chequeNo),
        withdrawal: parseNumber(txn.withdrawal) ?? 0,
        deposit: parseNumber(txn.deposit) ?? 0,
        balance: parseNumber(txn.balance),
        raw: txn,
      };
    });

    const meta = {
      pageUrl: normalizeText(payload.pageUrl) ?? undefined,
      account: normalizeText(payload.account) ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      receivedAt: new Date().toISOString(),
    };

    const source = normalizeText(payload.source) ?? "bookmarklet";

    const batchResult = await query<{ id: string }>(
      "INSERT INTO public.bank_import_batches (source, meta) VALUES ($1, $2::jsonb) RETURNING id",
      [source, JSON.stringify(meta)],
    );

    const batchId = batchResult.rows[0]?.id;
    if (!batchId) {
      throw new Error("Failed to create import batch.");
    }

    let imported = 0;
    const total = normalized.length;

    if (normalized.length > 0) {
      const columns = [
        "import_batch_id",
        "txn_date",
        "ref",
        "branch",
        "particulars",
        "cheque_no",
        "withdrawal",
        "deposit",
        "balance",
        "category",
        "status",
        "raw",
      ];

      const values: Array<string | number | null> = [];
      const rowsSql = normalized
        .map((row, rowIndex) => {
          const offset = rowIndex * columns.length;
          values.push(
            batchId,
            row.txn_date,
            row.ref,
            row.branch,
            row.particulars,
            row.cheque_no,
            row.withdrawal,
            row.deposit,
            row.balance,
            "SUSPENSE",
            "UNREVIEWED",
            JSON.stringify(row.raw),
          );

          const placeholders = columns.map((_, colIndex) => {
            const placeholder = `$${offset + colIndex + 1}`;
            return colIndex === columns.length - 1 ? `${placeholder}::jsonb` : placeholder;
          });

          return `(${placeholders.join(", ")})`;
        })
        .join(",\n");

      const insertSql = `
        INSERT INTO public.bank_transactions (${columns.join(", ")})
        VALUES ${rowsSql}
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      const insertResult = await query<{ id: string }>(insertSql, values);
      imported = insertResult.rows.length;
    }

    const skipped = total - imported;
    return jsonResponse({ ok: true, imported, skipped, total, batchId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("❌ /api/banking/bookmarklet failed:", err);
    return jsonResponse({ ok: false, error: message }, 500);
  }
}
