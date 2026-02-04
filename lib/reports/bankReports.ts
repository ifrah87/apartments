import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { calculateBankSummary } from "@/lib/reports/ledger";

type BankImportRow = {
  import_date: string;
  total_lines: string;
  matched: string;
  unmatched: string;
  reconciled: string;
};

export type BankImportSummary = {
  date: string;
  totalLines: number;
  matched: number;
  unmatched: number;
  reconciled: number;
};

export type BankImportReport = {
  rows: BankImportSummary[];
  totals: { totalLines: number; matched: number; unmatched: number; reconciled: number };
  latest?: BankImportSummary;
};

export async function loadBankImportSummary(): Promise<BankImportReport> {
  const baseUrl = getRequestBaseUrl(headers());
  const res = await fetch(`${baseUrl}/api/bank-import-summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch bank import summary");
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || "Failed to fetch bank import summary");
  const raw: BankImportRow[] = (payload?.ok ? payload.data : payload) as BankImportRow[];
  const rows = raw
    .map((row) => ({
      date: row.import_date,
      totalLines: Number(row.total_lines || 0),
      matched: Number(row.matched || 0),
      unmatched: Number(row.unmatched || 0),
      reconciled: Number(row.reconciled || 0),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalLines += row.totalLines;
      acc.matched += row.matched;
      acc.unmatched += row.unmatched;
      acc.reconciled += row.reconciled;
      return acc;
    },
    { totalLines: 0, matched: 0, unmatched: 0, reconciled: 0 },
  );
  return {
    rows,
    totals,
    latest: rows[0],
  };
}

export async function buildCashPosition() {
  const summary = await calculateBankSummary();
  return {
    bankBalance: summary.bankBalance,
    unreconciledCount: summary.unreconciledCount,
    lastUpdated: summary.lastUpdatedISO,
  };
}
