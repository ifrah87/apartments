/**
 * Bank Statement CSV Importer
 *
 * Usage:
 *   npx tsx scripts/import-bank.ts ./statements/march-2026.csv
 *   npx tsx scripts/import-bank.ts ./statements/march-2026.csv --dry-run
 *   npx tsx scripts/import-bank.ts ./statements/march-2026.csv --account "Current Account"
 *
 * CSV format (Salaam Bank):
 *   TRANDATE,ACCOUNTTYPE,TRAN_NO,BRANCH,PARTICULARS,CHEQUENO,WITHDRAWAL,DEPOSIT,BALANCE
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse as csvParse } from "papaparse";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Env loader (same pattern as run-migrations.ts)
// ---------------------------------------------------------------------------
function loadEnvFile(filename: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filename, "utf8");
    const env: Record<string, string> = {};
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
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

function loadEnv() {
  const cwd = process.cwd();
  for (const file of [".env.local", ".env"]) {
    const env = loadEnvFile(path.join(cwd, file));
    for (const [k, v] of Object.entries(env)) {
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// PARTICULARS parser
//
// Format: #EX:1#<description>#From: <PAYEE NAME>(_XXX)#REF:<reference>
// Examples:
//   #EX:1#Rent#From: QAALI DAUD ELMI(_009)#REF:35462306
//   #EX:1#ORFANE TOWER RENT PAYMENT#From: METAG INSAAT TICARET(_759)#REF:35511462
// ---------------------------------------------------------------------------
function parseParticulars(raw: string) {
  const description = raw.match(/#EX:\d+#([^#]+)#/)?.[1]?.trim() ?? raw.trim();
  const payee = raw.match(/#From:\s*(.+?)\s*\(/)?.[1]?.trim() ?? null;
  const reference = raw.match(/#REF:(\S+)/)?.[1] ?? null;
  return { description, payee, reference };
}

// ---------------------------------------------------------------------------
// Date: DD/MM/YYYY → YYYY-MM-DD
// ---------------------------------------------------------------------------
function parseDate(d: string): string {
  const parts = d.trim().split("/");
  if (parts.length !== 3) throw new Error(`Unparseable date: ${d}`);
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Fingerprint: SHA256(date|amount|TRAN_NO) — safe to re-import the same file
// ---------------------------------------------------------------------------
function makeFingerprint(date: string, amount: number, tranNo: string): string {
  return crypto
    .createHash("sha256")
    .update(`${date}|${amount.toFixed(2)}|${tranNo}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// CSV row type
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadEnv();

  const args = process.argv.slice(2);

  // --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage:
  npx tsx scripts/import-bank.ts <csv-file> [options]

Options:
  --dry-run            Preview rows without writing to DB
  --account <name>     Tag the bank account (e.g. "Current Account")
  --source <bank>      Tag the source bank (default: "salaam")
  --help               Show this help
    `.trim());
    process.exit(0);
  }

  // CSV file path (first non-flag argument)
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    console.error("❌ No CSV file specified.\nUsage: npx tsx scripts/import-bank.ts <file.csv>");
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");
  const accountIdx = args.indexOf("--account");
  const account = accountIdx !== -1 ? args[accountIdx + 1] : null;
  const sourceIdx = args.indexOf("--source");
  const sourceBank = sourceIdx !== -1 ? args[sourceIdx + 1] : "salaam";

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  // Parse CSV
  const raw = fs.readFileSync(absPath, "utf8");
  const { data: rows, errors } = csvParse(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  }) as { data: BankRow[]; errors: Array<{ message: string }> };

  if (errors.length) {
    console.warn(`⚠  CSV parse warnings: ${errors.map((e) => e.message).join(", ")}`);
  }

  if (!rows.length) {
    console.log("ℹ  No rows found in CSV.");
    process.exit(0);
  }

  // Map rows to transaction records
  type TxRecord = {
    fingerprint: string;
    txn_date: string;
    transaction_number: string;
    branch: string;
    particulars: string;
    description: string;
    payee: string | null;
    reference: string | null;
    withdrawal: number;
    deposit: number;
    balance: number | null;
    amount: number;
    source_bank: string;
    account_id: string | null;
    raw: Record<string, string>;
  };

  const records: TxRecord[] = [];
  const skippedParse: string[] = [];

  for (const row of rows) {
    try {
      const txnDate = parseDate(row.TRANDATE);
      const withdrawal = parseFloat(row.WITHDRAWAL || "0") || 0;
      const deposit = parseFloat(row.DEPOSIT || "0") || 0;
      const balance = parseFloat(row.BALANCE || "") || null;
      // amount: positive for deposits, negative for withdrawals
      const amount = deposit > 0 ? deposit : -withdrawal;
      const tranNo = (row.TRAN_NO || "").trim();
      const { description, payee, reference } = parseParticulars(row.PARTICULARS || "");
      const fingerprint = makeFingerprint(txnDate, amount, tranNo);

      records.push({
        fingerprint,
        txn_date: txnDate,
        transaction_number: tranNo,
        branch: (row.BRANCH || "").trim(),
        particulars: (row.PARTICULARS || "").trim(),
        description,
        payee,
        reference,
        withdrawal,
        deposit,
        balance,
        amount,
        source_bank: sourceBank,
        account_id: account,
        raw: { ...row },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skippedParse.push(`Row ${JSON.stringify(row.TRAN_NO)}: ${msg}`);
    }
  }

  if (skippedParse.length) {
    console.warn(`\n⚠  Skipped ${skippedParse.length} rows due to parse errors:`);
    skippedParse.forEach((m) => console.warn(`   ${m}`));
  }

  // Dry run: just print the table
  if (dryRun) {
    console.log(`\n📋 Dry run — ${records.length} rows would be imported:\n`);
    console.log(
      `${"Date".padEnd(12)} ${"Amount".padStart(10)} ${"Payee".padEnd(30)} ${"Description".padEnd(35)} ${"Ref".padEnd(12)} Fingerprint`
    );
    console.log("─".repeat(115));
    for (const r of records) {
      const amt = r.amount >= 0 ? `+${r.amount.toFixed(2)}` : r.amount.toFixed(2);
      console.log(
        `${r.txn_date.padEnd(12)} ${amt.padStart(10)} ${(r.payee ?? "—").padEnd(30)} ${r.description.padEnd(35)} ${(r.reference ?? "—").padEnd(12)} ${r.fingerprint.slice(0, 12)}…`
      );
    }
    console.log(`\n✅ Dry run complete. ${records.length} rows ready to import.`);
    if (account) console.log(`   Account tag: ${account}`);
    console.log("   Run without --dry-run to write to DB.\n");
    process.exit(0);
  }

  // Connect and insert
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set. Add it to .env.local");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  let imported = 0;
  let skipped = 0;

  try {
    for (const r of records) {
      const result = await pool.query(
        `INSERT INTO public.bank_transactions
           (txn_date, ref, branch, particulars, withdrawal, deposit, balance,
            fingerprint, source_bank, account_id, payee, transaction_number, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
         DO NOTHING`,
        [
          r.txn_date,
          r.reference,
          r.branch,
          r.particulars,
          r.withdrawal,
          r.deposit,
          r.balance,
          r.fingerprint,
          r.source_bank,
          r.account_id,
          r.payee,
          r.transaction_number,
          JSON.stringify(r.raw),
        ]
      );
      if (result.rowCount && result.rowCount > 0) {
        imported++;
      } else {
        skipped++;
      }
    }
  } finally {
    await pool.end();
  }

  console.log(`\n✓ Imported: ${imported} new transactions`);
  if (skipped > 0) console.log(`⚠ Skipped:  ${skipped} duplicates`);
  if (account) console.log(`  Account:   ${account}`);
  console.log();
}

main().catch((err) => {
  console.error("❌ Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
