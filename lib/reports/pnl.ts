import { fetchLedger, LedgerFilter, Txn } from "@/lib/reports/ledger";
import { Account, CHART_OF_ACCOUNTS, suggestAccountForTransaction } from "@/lib/reports/chartOfAccounts";

type AccountSummary = {
  accountId: string;
  accountName: string;
  type: "income" | "expense";
  amount: number;
};

export type PropertyPnL = {
  propertyId: string;
  propertyName: string;
  accounts: AccountSummary[];
  incomeTotal: number;
  expenseTotal: number;
  net: number;
};

export type PnLResult = {
  period: { start: string; end: string };
  consolidated: PropertyPnL;
  properties: PropertyPnL[];
};

function normalizeProperty(propertyId?: string | null) {
  if (!propertyId) return "UNASSIGNED";
  return String(propertyId).trim() || "UNASSIGNED";
}

function toDisplayName(propertyId: string) {
  if (propertyId === "UNASSIGNED") return "Unassigned";
  return propertyId.toUpperCase();
}

function upsertAccount(map: Map<string, AccountSummary>, account: Account, amount: number) {
  const current = map.get(account.id);
  const nextAmount = (current?.amount || 0) + Math.abs(amount);
  map.set(account.id, {
    accountId: account.id,
    accountName: account.name,
    type: account.type,
    amount: Number(nextAmount.toFixed(2)),
  });
}

function mapToSummary(propertyId: string, rows: Map<string, AccountSummary>): PropertyPnL {
  const accounts = Array.from(rows.values()).sort((a, b) => {
    if (a.type === b.type) return a.accountName.localeCompare(b.accountName);
    return a.type === "income" ? -1 : 1;
  });
  const incomeTotal = accounts.filter((acc) => acc.type === "income").reduce((sum, acc) => sum + acc.amount, 0);
  const expenseTotal = accounts.filter((acc) => acc.type === "expense").reduce((sum, acc) => sum + acc.amount, 0);
  return {
    propertyId,
    propertyName: toDisplayName(propertyId),
    accounts,
    incomeTotal: Number(incomeTotal.toFixed(2)),
    expenseTotal: Number(expenseTotal.toFixed(2)),
    net: Number((incomeTotal - expenseTotal).toFixed(2)),
  };
}

export async function calculateProfitAndLoss(filter: LedgerFilter & { start: string; end: string }): Promise<PnLResult> {
  const rows = await fetchLedger(filter);

  const propertyBuckets = new Map<string, Map<string, AccountSummary>>();
  const consolidatedBuckets = new Map<string, AccountSummary>();

  rows.forEach((txn) => {
    const propertyId = normalizeProperty(txn.property_id);
    const account = suggestAccountForTransaction(txn);
    const amount = Number(txn.amount) || 0;
    if (!amount) return;

    if (!propertyBuckets.has(propertyId)) {
      propertyBuckets.set(propertyId, new Map());
    }

    upsertAccount(propertyBuckets.get(propertyId)!, account, amount);
    upsertAccount(consolidatedBuckets, account, amount);
  });

  const properties = Array.from(propertyBuckets.entries()).map(([propertyId, accountMap]) =>
    mapToSummary(propertyId, accountMap),
  );

  const consolidated = mapToSummary("ALL", consolidatedBuckets);
  consolidated.propertyName = "All Properties";

  return {
    period: { start: filter.start || "", end: filter.end || "" },
    consolidated,
    properties: properties.sort((a, b) => a.propertyName.localeCompare(b.propertyName)),
  };
}
