import { buildApiUrl } from "@/lib/utils/baseUrl";
import { calculateBankSummary } from "@/lib/reports/ledger";

type ReconciliationItem = {
  property_id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
};

type ReconciliationFilters = {
  propertyId?: string;
};

export type ReconciliationReport = {
  bankBalance: number;
  bookBalance: number;
  difference: number;
  outstandingPayments: ReconciliationItem[];
  inTransitDeposits: ReconciliationItem[];
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

export async function buildReconciliationReport(filters: ReconciliationFilters): Promise<ReconciliationReport> {
  const [items, summary, balances] = await Promise.all([
    fetchJson<ReconciliationItem[]>("/api/bank-reconciliation").catch(() => [] as ReconciliationItem[]),
    calculateBankSummary({}),
    fetchJson<any[]>("/api/bank-balances").catch(() => [] as any[]),
  ]);
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const latestBalanceRow = balances[balances.length - 1];
  const bookBalance = latestBalanceRow ? toNumber(latestBalanceRow.book_balance) : summary.bankBalance;

  const filteredItems = items.filter((item) => {
    if (!propertyFilter) return true;
    return (item.property_id || "").toLowerCase() === propertyFilter;
  });
  const outstandingPayments = filteredItems.filter((item) => item.type === "outstanding_payment");
  const inTransitDeposits = filteredItems.filter((item) => item.type === "in_transit");
  const outstandingTotal = outstandingPayments.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const inTransitTotal = inTransitDeposits.reduce((sum, item) => sum + toNumber(item.amount), 0);

  const difference = Number((summary.bankBalance - (bookBalance + outstandingTotal + inTransitTotal)).toFixed(2));

  return {
    bankBalance: summary.bankBalance,
    bookBalance,
    difference,
    outstandingPayments,
    inTransitDeposits,
  };
}
