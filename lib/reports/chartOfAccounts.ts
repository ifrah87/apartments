export type AccountType = "income" | "expense";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  keywords?: string[];
  fallback?: boolean;
};

export const CHART_OF_ACCOUNTS: Account[] = [
  {
    id: "4000",
    name: "Rental Income",
    type: "income",
    keywords: ["rent", "lease", "tenant"],
    fallback: true,
  },
  {
    id: "4010",
    name: "Other Property Income",
    type: "income",
    keywords: ["fee", "late", "penalty", "deposit"],
  },
  {
    id: "5000",
    name: "Maintenance & Repairs",
    type: "expense",
    keywords: ["repair", "maintenance", "plumb", "hvac", "fix"],
  },
  {
    id: "5050",
    name: "Cleaning & Housekeeping",
    type: "expense",
    keywords: ["clean", "janitor", "housekeep"],
  },
  {
    id: "5060",
    name: "Boiler & HVAC Maintenance",
    type: "expense",
    keywords: ["boiler", "furnace", "hvac"],
  },
  {
    id: "5070",
    name: "Lift & Elevator Services",
    type: "expense",
    keywords: ["lift", "elevator"],
  },
  {
    id: "5080",
    name: "Plumbing Services",
    type: "expense",
    keywords: ["plumbing", "plumber", "pipe"],
  },
  {
    id: "5090",
    name: "Roof Inspection & Repairs",
    type: "expense",
    keywords: ["roof", "inspection"],
  },
  {
    id: "5100",
    name: "Utilities",
    type: "expense",
    keywords: ["utility", "electric", "water", "gas"],
  },
  {
    id: "5200",
    name: "Property Insurance",
    type: "expense",
    keywords: ["insurance", "premium"],
  },
  {
    id: "5300",
    name: "Property Taxes & Licenses",
    type: "expense",
    keywords: ["tax", "license"],
  },
  {
    id: "5400",
    name: "Management & Professional Fees",
    type: "expense",
    keywords: ["consult", "legal", "account", "management", "software"],
  },
  {
    id: "5450",
    name: "Payroll & Salaries",
    type: "expense",
    keywords: ["salary", "payroll", "wage", "stipend"],
  },
  {
    id: "5999",
    name: "Miscellaneous Expense",
    type: "expense",
    keywords: [],
    fallback: true,
  },
];

function findFallback(type: AccountType) {
  return (
    CHART_OF_ACCOUNTS.find((account) => account.type === type && account.fallback) ||
    CHART_OF_ACCOUNTS.find((account) => account.type === type)
  );
}

export function suggestAccountForTransaction(txn: { description?: string; reference?: string; amount: number }) {
  const haystack = `${txn.description || ""} ${txn.reference || ""}`.toLowerCase();
  const matched = CHART_OF_ACCOUNTS.find(
    (account) => (account.keywords || []).some((keyword) => haystack.includes(keyword.toLowerCase())),
  );
  if (matched) return matched;

  if (Number(txn.amount) >= 0) {
    return findFallback("income") || CHART_OF_ACCOUNTS[0];
  }
  return findFallback("expense") || CHART_OF_ACCOUNTS[CHART_OF_ACCOUNTS.length - 1];
}
