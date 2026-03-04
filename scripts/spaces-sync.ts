/**
 * DO Spaces → bank_transactions sync
 *
 * Lists all CSVs under bank-imports/ in Spaces, skips already-processed
 * files (tracked in bank_import_log), and imports new ones.
 *
 * Usage:
 *   npx tsx scripts/spaces-sync.ts                         # one-shot
 *   npx tsx scripts/spaces-sync.ts --watch                 # poll every 5 min
 *   npx tsx scripts/spaces-sync.ts --watch --interval 2    # poll every 2 min
 *   npx tsx scripts/spaces-sync.ts --prefix bank-imports/default/2026-03/
 *   npx tsx scripts/spaces-sync.ts --dry-run               # list new files only
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse as csvParse } from "papaparse";
import { Pool } from "pg";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------
function loadEnv() {
  const cwd = process.cwd();
  for (const file of [".env.local", ".env"]) {
    try {
      const content = fs.readFileSync(path.join(cwd, file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // file not found — skip
    }
  }
}

// ---------------------------------------------------------------------------
// Spaces client (built inline so the script has no Next.js deps)
// ---------------------------------------------------------------------------
function makeSpacesClient() {
  const endpoint = process.env.SPACES_ENDPOINT ?? "lon1.digitaloceanspaces.com";
  const accessKeyId = process.env.SPACES_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.SPACES_SECRET_KEY ?? "";
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("SPACES_ACCESS_KEY and SPACES_SECRET_KEY must be set in .env.local");
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

async function listSpacesCSVs(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<Array<{ key: string; size: number; lastModified: Date | undefined }>> {
  const all: Array<{ key: string; size: number; lastModified: Date | undefined }> = [];
  let continuationToken: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Key.toLowerCase().endsWith(".csv")) {
        all.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified });
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return all;
}

async function downloadCSV(client: S3Client, bucket: string, key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for key: ${key}`);
  const buf = await streamToBuffer(res.Body as Readable);
  return buf.toString("utf8");
}

// ---------------------------------------------------------------------------
// Salaam Bank CSV parsing  (same logic as import-bank.ts)
// ---------------------------------------------------------------------------
type BankRow = {
  TRANDATE: string;
  ACCOUNTTYPE: string;
  TRAN_NO: string;
  BRANCH: string;
  PARTICULARS: string;
  CHEQUENO: string;
  WITHDRAWAL: string;
  DEPOSIT: string;
  BALANCE: string;
};

function parseParticulars(raw: string) {
  const description = raw.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? raw.trim();
  const payee       = raw.match(/#From:\s*(.+?)\s*\(/)?.[1]?.trim() ?? null;
  const reference   = raw.match(/#REF:(\S+)/)?.[1] ?? null;
  return { description, payee, reference };
}

function parseDate(d: string): string {
  const s = d.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [day, month, year] = s.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  throw new Error(`Unparseable date: ${d}`);
}

function makeFingerprint(date: string, amount: number, tranNo: string): string {
  return crypto
    .createHash("sha256")
    .update(`${date}|${amount.toFixed(2)}|${tranNo}`)
    .digest("hex");
}

type TxRecord = {
  txn_date: string;
  transaction_number: string;
  branch: string;
  particulars: string;
  description: string;
  payee: string;
  reference: string | null;
  withdrawal: number;
  deposit: number;
  balance: number | null;
  fingerprint: string;
};

function parseCSV(csv: string): { records: TxRecord[]; skippedParse: number } {
  const { data: rows, errors } = csvParse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  }) as { data: BankRow[]; errors: Array<{ message: string }> };

  if (errors.length) {
    console.warn(`  ⚠  CSV warnings: ${errors.map((e) => e.message).join(", ")}`);
  }

  const records: TxRecord[] = [];
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
        txn_date,
        transaction_number: tranNo,
        branch:      (row.BRANCH || "").trim(),
        particulars: (row.PARTICULARS || "").trim(),
        description,
        payee:       payee ?? (description || "Unknown"),
        reference,
        withdrawal,
        deposit,
        balance,
        fingerprint: makeFingerprint(txn_date, amount, tranNo),
      });
    } catch {
      skippedParse++;
    }
  }

  return { records, skippedParse };
}

// ---------------------------------------------------------------------------
// Insert one file's rows into bank_transactions
// ---------------------------------------------------------------------------
async function importFile(
  pool: Pool,
  key: string,
  records: TxRecord[],
): Promise<{ inserted: number; skippedDupes: number }> {
  let inserted    = 0;
  let skippedDupes = 0;

  for (const r of records) {
    const result = await pool.query(
      `INSERT INTO public.bank_transactions
         (txn_date, particulars, payee, ref, deposit, withdrawal,
          fingerprint, source_bank, source_key, transaction_number,
          status, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'spaces-sync', $8, $9, 'UNREVIEWED', 'SUSPENSE')
       ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
       DO NOTHING`,
      [
        r.txn_date,
        r.particulars,
        r.payee,
        r.reference,
        r.deposit,
        r.withdrawal,
        r.fingerprint,
        key,
        r.transaction_number,
      ],
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
    else skippedDupes++;
  }

  return { inserted, skippedDupes };
}

// ---------------------------------------------------------------------------
// Log result to bank_import_log
// ---------------------------------------------------------------------------
async function logResult(
  pool: Pool,
  key: string,
  result: { inserted: number; skippedDupes: number; skippedParse: number; error?: string },
) {
  await pool.query(
    `INSERT INTO public.bank_import_log
       (key, inserted, skipped_dupes, skipped_parse, status, error_msg)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO UPDATE SET
       processed_at  = NOW(),
       inserted      = EXCLUDED.inserted,
       skipped_dupes = EXCLUDED.skipped_dupes,
       skipped_parse = EXCLUDED.skipped_parse,
       status        = EXCLUDED.status,
       error_msg     = EXCLUDED.error_msg`,
    [
      key,
      result.inserted,
      result.skippedDupes,
      result.skippedParse,
      result.error ? "error" : "ok",
      result.error ?? null,
    ],
  );
}

// ---------------------------------------------------------------------------
// Get set of already-processed keys
// ---------------------------------------------------------------------------
async function getProcessedKeys(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ key: string }>(
    `SELECT key FROM public.bank_import_log WHERE status = 'ok'`,
  );
  return new Set(rows.map((r) => r.key));
}

// ---------------------------------------------------------------------------
// One sync pass
// ---------------------------------------------------------------------------
async function syncOnce(
  pool: Pool | null,
  spaces: S3Client,
  bucket: string,
  prefix: string,
  dryRun: boolean,
): Promise<void> {
  const allFiles = await listSpacesCSVs(spaces, bucket, prefix);
  const processed = pool ? await getProcessedKeys(pool) : new Set<string>();

  const newFiles = allFiles.filter((f) => !processed.has(f.key));

  if (!newFiles.length) {
    console.log(`[sync] No new files under ${prefix}`);
    return;
  }

  console.log(`[sync] Found ${newFiles.length} new file(s) to process`);

  for (const file of newFiles) {
    const shortKey = file.key.split("/").slice(-1)[0];
    console.log(`\n  → ${file.key}`);

    if (dryRun) {
      // Still download and parse so we can show row counts
      try {
        const csv = await downloadCSV(spaces, bucket, file.key);
        const { records, skippedParse } = parseCSV(csv);
        console.log(`     ${records.length} rows would be imported, ${skippedParse} skipped`);
        for (const r of records.slice(0, 5)) {
          const amt = r.deposit > 0 ? `+${r.deposit.toFixed(2)}` : `-${r.withdrawal.toFixed(2)}`;
          console.log(`       ${r.txn_date}  ${amt.padStart(10)}  ${r.payee}`);
        }
        if (records.length > 5) console.log(`       … and ${records.length - 5} more`);
      } catch (err) {
        console.error(`     ✗ could not parse: ${err instanceof Error ? err.message : err}`);
      }
      continue;
    }

    try {
      const csv      = await downloadCSV(spaces, bucket, file.key);
      const { records, skippedParse } = parseCSV(csv);
      console.log(`     parsed: ${records.length} rows, ${skippedParse} skipped`);

      const { inserted, skippedDupes } = await importFile(pool!, file.key, records);
      await logResult(pool!, file.key, { inserted, skippedDupes, skippedParse });

      console.log(`     ✓ inserted=${inserted} dupes=${skippedDupes} parse_err=${skippedParse}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`     ✗ error: ${msg}`);
      await logResult(pool!, file.key, {
        inserted: 0, skippedDupes: 0, skippedParse: 0, error: msg,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadEnv();

  const args      = process.argv.slice(2);
  const watch     = args.includes("--watch");
  const dryRun    = args.includes("--dry-run");
  const intIdx    = args.indexOf("--interval");
  const intervalMin = intIdx !== -1 ? parseInt(args[intIdx + 1] ?? "5", 10) : 5;
  const prefixIdx = args.indexOf("--prefix");
  const prefix    = prefixIdx !== -1 ? args[prefixIdx + 1] : "bank-imports/";
  const bucket    = process.env.SPACES_BUCKET ?? "orfanerealestate";

  // In dry-run mode we don't need a DB connection at all
  let pool: Pool | null = null;
  if (!dryRun) {
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL not set in .env.local");
      process.exit(1);
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: (process.env.DATABASE_URL as string).includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }

  let spaces: S3Client;
  try {
    spaces = makeSpacesClient();
  } catch (err) {
    console.error("❌", err instanceof Error ? err.message : err);
    await pool?.end();
    process.exit(1);
  }

  console.log(`DO Spaces sync — bucket=${bucket} prefix=${prefix}`);
  if (dryRun) console.log("(dry-run mode — no DB writes)");
  if (watch)  console.log(`(watch mode — polling every ${intervalMin} min)`);
  console.log();

  await syncOnce(pool, spaces, bucket, prefix, dryRun);

  if (watch) {
    const ms = intervalMin * 60 * 1000;
    setInterval(async () => {
      console.log(`\n[${new Date().toISOString()}] polling…`);
      await syncOnce(pool, spaces, bucket, prefix, dryRun);
    }, ms);
  } else {
    await pool?.end();
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
