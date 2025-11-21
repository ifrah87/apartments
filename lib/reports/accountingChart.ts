export type AccountCategory = "asset" | "liability" | "equity" | "income" | "expense";

export type AccountingAccount = {
  id: string;
  name: string;
  category: AccountCategory;
  isCash?: boolean;
  cashflowSection?: "operating" | "investing" | "financing";
};

export const ACCOUNTING_CHART: AccountingAccount[] = [
  { id: "1010", name: "Operating Cash", category: "asset", isCash: true, cashflowSection: "operating" },
  { id: "1015", name: "Security Deposit Cash", category: "asset", isCash: true, cashflowSection: "operating" },
  { id: "1200", name: "Accounts Receivable", category: "asset", cashflowSection: "operating" },
  { id: "1500", name: "Furniture & Equipment", category: "asset", cashflowSection: "investing" },
  { id: "2000", name: "Accounts Payable", category: "liability", cashflowSection: "operating" },
  { id: "2100", name: "Security Deposits Liability", category: "liability", cashflowSection: "financing" },
  { id: "3100", name: "Owner Equity", category: "equity", cashflowSection: "financing" },
  { id: "4000", name: "Rental Income", category: "income", cashflowSection: "operating" },
  { id: "5000", name: "Maintenance Expense", category: "expense", cashflowSection: "operating" },
  { id: "5050", name: "Cleaning Expense", category: "expense", cashflowSection: "operating" },
  { id: "5060", name: "Boiler Maintenance", category: "expense", cashflowSection: "operating" },
  { id: "6000", name: "Utilities Expense", category: "expense", cashflowSection: "operating" },
];

export function findAccount(accountId: string) {
  return ACCOUNTING_CHART.find((account) => account.id === accountId);
}
