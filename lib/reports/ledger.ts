// lib/reports/ledger.ts
import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

export type Txn = {
  date: string;
  description: string;
  reference?: string;
  property_id?: string;
  unit?: string;
  amount: number; // +income, -expense
  raw?: any;
};

export type LedgerFilter = {
  start?: string;
  end?: string;
  propertyId?: string;
};

// Convert DD-MM-YYYY to ISO (YYYY-MM-DD)
function toISOMaybe(s: string) {
  const parts = s.split(/[-/]/);
  if (parts.length !== 3) return s;
  if (parts[0].length === 4) return s;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export async function fetchLedger(filter: LedgerFilter = {}): Promise<Txn[]> {
  const baseUrl = getRequestBaseUrl(headers());
  const params = new URLSearchParams();
  if (filter.start) params.set("start", filter.start);
  if (filter.end) params.set("end", filter.end);
  if (filter.propertyId) params.set("propertyId", filter.propertyId);
  const url = params.toString() ? `/api/ledger?${params.toString()}` : "/api/ledger";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) return [];
  const payload = await res.json();
  if (payload?.ok === false) return [];
  const all: Txn[] = payload?.ok ? payload.data : payload;

  const start = filter.start ? new Date(toISOMaybe(filter.start)) : undefined;
  const end = filter.end ? new Date(toISOMaybe(filter.end)) : undefined;

  return all.filter((t) => {
    const d = new Date(toISOMaybe(t.date));
    const okStart = !start || d >= start;
    const okEnd = !end || d <= end;
    const okProp =
      !filter.propertyId ||
      (t.property_id || "").toLowerCase() === (filter.propertyId || "").toLowerCase();
    return okStart && okEnd && okProp;
  });
}

export function isUnreconciled(txn: Txn): boolean {
  if (txn.amount < 0) {
    const s = (txn.description || "").toLowerCase();
    const matched = ["utilities", "water", "gas", "electric", "repair", "clean", "fee", "insurance"]
      .some((k) => s.includes(k));
    return !matched;
  }
  return !(
    /\brent\b|\btenant\b|\bso\b/.test((txn.description || "").toLowerCase()) ||
    /\bunit\b|\bapt\b|\bflat\b/.test((txn.reference || "").toLowerCase())
  );
}

export async function calculateBankSummary(filter: LedgerFilter = {}) {
  const rows = await fetchLedger(filter);
  const bankBalance = rows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const unreconciledCount = rows.filter(isUnreconciled).length;

  const last = rows
    .map((r) => new Date(toISOMaybe(r.date)).getTime())
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a)[0];

  return {
    bankBalance,
    unreconciledCount,
    lastUpdatedISO: last ? new Date(last).toISOString() : null,
  };
}
