import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchLedger } from "@/lib/reports/ledger";
import TransactionCategoryTable from "@/components/TransactionCategoryTable";
import { getTransactionCategories } from "@/lib/reports/categoryStore";

export const runtime = "nodejs";

export default async function AccountTransactionsPage() {
  const [transactions, categoryMap] = await Promise.all([fetchLedger(), getTransactionCategories()]);
  const rows = transactions.map((txn, idx) => ({
    ...txn,
    id: `${txn.date}-${(txn as any).description ?? (txn as any).particulars ?? "txn"}-${idx}`,
  }));

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Account Transactions
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Account Transactions</h1>
        <p className="text-sm text-slate-500">
          All ledger entries from <code>bank_all_buildings_simple.csv</code>.
        </p>
      </header>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
        </div>
        <TransactionCategoryTable transactions={rows} initialCategories={categoryMap} />
      </SectionCard>
    </div>
  );
}
