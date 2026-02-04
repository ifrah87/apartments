import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { ACCOUNTING_CHART, findAccount, type AccountCategory } from "@/lib/reports/accountingChart";

export type JournalEntryRow = {
  entry_id: string;
  property_id: string;
  date: string;
  account_id: string;
  description?: string;
  debit: string;
  credit: string;
};

export type JournalEntry = {
  entryId: string;
  propertyId: string;
  date: string;
  lines: {
    accountId: string;
    accountName: string;
    category: AccountCategory;
    debit: number;
    credit: number;
    description?: string;
  }[];
};

export type AccountingFilters = {
  propertyId?: string;
  start?: string;
  end?: string;
  accountId?: string;
};

export type BalanceSheetSection = {
  label: string;
  rows: { accountId: string; accountName: string; balance: number }[];
  total: number;
};

export type BalanceSheetResult = {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
};

export type TrialBalanceRow = {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
};

export type CashflowSection = {
  label: string;
  change: number;
};

export type CashflowResult = {
  sections: CashflowSection[];
  netChange: number;
  endingCash: number;
};

export type GeneralLedgerRow = {
  date: string;
  entryId: string;
  accountId: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
};

async function fetchJournalEntries(): Promise<JournalEntryRow[]> {
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/journal-entries`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load journal entries");
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || "Failed to load journal entries");
  return (payload?.ok ? payload.data : payload) as JournalEntryRow[];
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function withinRange(date: Date, start?: Date, end?: Date) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function normalizeEntries(rows: JournalEntryRow[], filters: AccountingFilters) {
  const start = filters.start ? new Date(filters.start) : undefined;
  const end = filters.end ? new Date(filters.end) : undefined;
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  return rows
    .map((row) => {
      const account = findAccount(row.account_id);
      if (!account) return null;
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime()) || !withinRange(date, start, end)) return null;
      if (propertyFilter && (row.property_id || "").toLowerCase() !== propertyFilter && (row.property_id || "").toLowerCase() !== "all") {
        return null;
      }
      return {
        entryId: row.entry_id,
        propertyId: row.property_id,
        date: row.date,
        accountId: row.account_id,
        accountName: account.name,
        category: account.category,
        debit: toNumber(row.debit),
        credit: toNumber(row.credit),
        description: row.description,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function accumulateAccountBalances(entries: ReturnType<typeof normalizeEntries>) {
  const balances = new Map<string, { accountName: string; category: AccountCategory; debit: number; credit: number }>();
  entries.forEach((line) => {
    if (!balances.has(line.accountId)) {
      balances.set(line.accountId, { accountName: line.accountName, category: line.category, debit: 0, credit: 0 });
    }
    const bucket = balances.get(line.accountId)!;
    bucket.debit += line.debit;
    bucket.credit += line.credit;
  });
  return balances;
}

function balanceForCategory(entry: { debit: number; credit: number }, category: AccountCategory) {
  if (category === "asset" || category === "expense") {
    return entry.debit - entry.credit;
  }
  return entry.credit - entry.debit;
}

export async function buildBalanceSheet(filters: AccountingFilters = {}): Promise<BalanceSheetResult> {
  const rows = await fetchJournalEntries();
  const lines = normalizeEntries(rows, filters);
  const balances = accumulateAccountBalances(lines);
  const assets = [];
  const liabilities = [];
  const equity = [];

  balances.forEach((entry, accountId) => {
    const balance = balanceForCategory(entry, entry.category);
    if (!balance) return;
    const row = { accountId, accountName: entry.accountName, balance: Number(balance.toFixed(2)) };
    if (entry.category === "asset") assets.push(row);
    if (entry.category === "liability") liabilities.push(row);
    if (entry.category === "equity") equity.push(row);
  });

  const makeSection = (label: string, list: typeof assets) => ({
    label,
    rows: list.sort((a, b) => a.accountName.localeCompare(b.accountName)),
    total: Number(list.reduce((sum, row) => sum + row.balance, 0).toFixed(2)),
  });

  return {
    assets: makeSection("Assets", assets),
    liabilities: makeSection("Liabilities", liabilities),
    equity: makeSection("Equity", equity),
  };
}

export async function buildTrialBalance(filters: AccountingFilters = {}): Promise<TrialBalanceRow[]> {
  const rows = await fetchJournalEntries();
  const lines = normalizeEntries(rows, filters);
  const balances = accumulateAccountBalances(lines);
  return Array.from(balances.entries())
    .map(([accountId, entry]) => ({
      accountId,
      accountName: entry.accountName,
      debit: Number(entry.debit.toFixed(2)),
      credit: Number(entry.credit.toFixed(2)),
    }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName));
}

export async function buildCashflowStatement(filters: AccountingFilters = {}): Promise<CashflowResult> {
  const rows = await fetchJournalEntries();
  const lines = normalizeEntries(rows, filters);
  const balances = accumulateAccountBalances(lines);
  const sections = {
    operating: 0,
    investing: 0,
    financing: 0,
  };
  let endingCash = 0;

  balances.forEach((entry, accountId) => {
    const account = findAccount(accountId);
    if (!account) return;
    const balance = balanceForCategory(entry, account.category);
    if (account.isCash) {
      endingCash += balance;
    }
    const section = account.cashflowSection || "operating";
    if (section === "operating") sections.operating += balance;
    if (section === "investing") sections.investing += balance;
    if (section === "financing") sections.financing += balance;
  });

  const sectionRows: CashflowSection[] = [
    { label: "Operating activities", change: Number(sections.operating.toFixed(2)) },
    { label: "Investing activities", change: Number(sections.investing.toFixed(2)) },
    { label: "Financing activities", change: Number(sections.financing.toFixed(2)) },
  ];

  const netChange = Number(sectionRows.reduce((sum, section) => sum + section.change, 0).toFixed(2));

  return {
    sections: sectionRows,
    netChange,
    endingCash: Number(endingCash.toFixed(2)),
  };
}

export async function buildGeneralLedger(filters: AccountingFilters = {}): Promise<GeneralLedgerRow[]> {
  const rows = await fetchJournalEntries();
  const lines = normalizeEntries(rows, filters).filter((line) => {
    if (!filters.accountId) return true;
    return line.accountId === filters.accountId;
  });
  return lines
    .map((line) => ({
      date: line.date,
      entryId: line.entryId,
      accountId: line.accountId,
      accountName: line.accountName,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function listJournalEntries(filters: AccountingFilters = {}): Promise<JournalEntry[]> {
  const rows = await fetchJournalEntries();
  const lines = normalizeEntries(rows, filters);
  const grouped = new Map<string, JournalEntry>();
  lines.forEach((line) => {
    if (!grouped.has(line.entryId)) {
      grouped.set(line.entryId, {
        entryId: line.entryId,
        propertyId: line.propertyId,
        date: line.date,
        lines: [],
      });
    }
    grouped.get(line.entryId)!.lines.push({
      accountId: line.accountId,
      accountName: line.accountName,
      category: line.category,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    });
  });
  return Array.from(grouped.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function listChartOfAccounts() {
  return ACCOUNTING_CHART.slice().sort((a, b) => a.id.localeCompare(b.id));
}
