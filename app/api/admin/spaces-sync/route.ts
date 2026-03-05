import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { parse as csvParse } from "papaparse";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 min

// ---------------------------------------------------------------------------
// S3 / Spaces helpers
// ---------------------------------------------------------------------------
function makeSpacesClient() {
  const endpoint = process.env.SPACES_ENDPOINT ?? "lon1.digitaloceanspaces.com";
  const accessKeyId = process.env.SPACES_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.SPACES_SECRET_KEY ?? "";
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("SPACES_ACCESS_KEY and SPACES_SECRET_KEY env vars not set");
  }
  return new S3Client({
    region: "us-east-1",
    endpoint: `https://${endpoint}`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function listSpacesCSVs(client: S3Client, bucket: string, prefix: string) {
  const all: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key?.toLowerCase().endsWith(".csv")) {
        all.push({ key: obj.Key, size: obj.Size ?? 0 });
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
  return all;
}

async function downloadCSV(client: S3Client, bucket: string, key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for key: ${key}`);
  return (await streamToBuffer(res.Body as Readable)).toString("utf8");
}

// ---------------------------------------------------------------------------
// CSV parsing (Salaam Bank format)
// ---------------------------------------------------------------------------
type BankRow = {
  TRANDATE: string; TRAN_NO: string; BRANCH: string;
  PARTICULARS: string; WITHDRAWAL: string; DEPOSIT: string; BALANCE: string;
};

function parseParticulars(raw: string) {
  const description = raw.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? raw.trim();
  const payee       = raw.match(/#From:\s*(.+?)\s*\(/)?.[1]?.trim() ?? null;
  const reference   = raw.match(/#REF:(\S+)/)?.[1] ?? null;
  return { description, payee, reference };
}

function parseDate(d: string): string {
  const s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [day, month, year] = s.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  throw new Error(`Unparseable date: ${d}`);
}

function makeFingerprint(date: string, amount: number, tranNo: string): string {
  return crypto.createHash("sha256").update(`${date}|${amount.toFixed(2)}|${tranNo}`).digest("hex");
}

function parseCSV(csv: string) {
  const { data: rows } = csvParse(csv, {
    header: true, skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  }) as { data: BankRow[]; errors: unknown[] };

  const records = [];
  let skippedParse = 0;

  for (const row of rows) {
    try {
      const txn_date   = parseDate(row.TRANDATE);
      const withdrawal = parseFloat(row.WITHDRAWAL || "0") || 0;
      const deposit    = parseFloat(row.DEPOSIT    || "0") || 0;
      const balance    = parseFloat(row.BALANCE    || "")  || null;
      const amount     = deposit > 0 ? deposit : -withdrawal;
      const tranNo     = (row.TRAN_NO || "").trim();
      const { description, payee, reference } = parseParticulars(row.PARTICULARS || "");
      records.push({
        txn_date, transaction_number: tranNo,
        branch: (row.BRANCH || "").trim(),
        particulars: (row.PARTICULARS || "").trim(),
        payee: payee ?? (description || "Unknown"),
        reference, withdrawal, deposit, balance,
        fingerprint: makeFingerprint(txn_date, amount, tranNo),
      });
    } catch { skippedParse++; }
  }
  return { records, skippedParse };
}

// ---------------------------------------------------------------------------
// GET /api/admin/spaces-sync?dry_run=1&prefix=bank-imports/
// POST /api/admin/spaces-sync  (triggers actual import)
// ---------------------------------------------------------------------------
async function runSync(dryRun: boolean, prefix: string, force = false) {
  const bucket = process.env.SPACES_BUCKET ?? "orfanerealestate";
  const spaces = makeSpacesClient();

  const allFiles = await listSpacesCSVs(spaces, bucket, prefix);

  // Get already-processed keys (ignored when force=true to allow balance backfill)
  const { rows: logRows } = await query<{ key: string }>(
    `SELECT key FROM public.bank_import_log WHERE status = 'ok'`,
    [],
  );
  const processed = new Set(logRows.map((r) => r.key));
  const newFiles = force ? allFiles : allFiles.filter((f) => !processed.has(f.key));

  const results: { key: string; rows: number; inserted: number; skippedDupes: number; skippedParse: number; error?: string }[] = [];

  for (const file of newFiles) {
    try {
      const csv = await downloadCSV(spaces, bucket, file.key);
      const { records, skippedParse } = parseCSV(csv);

      if (dryRun) {
        results.push({ key: file.key, rows: records.length, inserted: 0, skippedDupes: 0, skippedParse });
        continue;
      }

      let inserted = 0, skippedDupes = 0;
      for (const r of records) {
        const res = await query(
          `INSERT INTO public.bank_transactions
             (txn_date, particulars, payee, ref, deposit, withdrawal, balance,
              fingerprint, source_bank, source_key, transaction_number,
              status, category)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'spaces-sync',$9,$10,'UNREVIEWED','SUSPENSE')
           ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
           DO UPDATE SET balance = EXCLUDED.balance WHERE public.bank_transactions.balance IS NULL`,
          [r.txn_date, r.particulars, r.payee, r.reference, r.deposit, r.withdrawal, r.balance,
           r.fingerprint, file.key, r.transaction_number],
        );
        if (res.rowCount && res.rowCount > 0) inserted++; else skippedDupes++;
      }

      await query(
        `INSERT INTO public.bank_import_log (key, inserted, skipped_dupes, skipped_parse, status)
         VALUES ($1,$2,$3,$4,'ok')
         ON CONFLICT (key) DO UPDATE SET
           processed_at=NOW(), inserted=EXCLUDED.inserted,
           skipped_dupes=EXCLUDED.skipped_dupes, skipped_parse=EXCLUDED.skipped_parse, status='ok', error_msg=NULL`,
        [file.key, inserted, skippedDupes, skippedParse],
      );

      results.push({ key: file.key, rows: records.length, inserted, skippedDupes, skippedParse });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (!dryRun) {
        await query(
          `INSERT INTO public.bank_import_log (key, inserted, skipped_dupes, skipped_parse, status, error_msg)
           VALUES ($1,0,0,0,'error',$2)
           ON CONFLICT (key) DO UPDATE SET processed_at=NOW(), status='error', error_msg=EXCLUDED.error_msg`,
          [file.key, error],
        ).catch(() => {});
      }
      results.push({ key: file.key, rows: 0, inserted: 0, skippedDupes: 0, skippedParse: 0, error });
    }
  }

  return {
    totalFiles: allFiles.length,
    alreadyProcessed: processed.size,
    newFiles: newFiles.length,
    dryRun,
    results,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dry_run") === "1" || searchParams.get("dry_run") === "true";
    const prefix = searchParams.get("prefix") ?? "bank-imports/";
    const force  = searchParams.get("force") === "1" || searchParams.get("force") === "true";
    const data = await runSync(dryRun, prefix, force);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prefix = (body.prefix as string) ?? "bank-imports/";
    const force  = body.force === true;
    const data = await runSync(false, prefix, force);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
