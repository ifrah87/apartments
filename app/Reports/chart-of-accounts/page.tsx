import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { listChartOfAccounts } from "@/lib/reports/accountingReports";

export const runtime = "nodejs";

export default async function ChartOfAccountsPage() {
  const accounts = listChartOfAccounts();

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Chart of Accounts
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Chart of Accounts</h1>
        <p className="text-sm text-slate-500">Reference list of every account in the system.</p>
      </header>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">{accounts.length} accounts</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-sm text-slate-700">{account.id}</td>
                <td className="px-4 py-2 text-slate-900">{account.name}</td>
                <td className="px-4 py-2 text-slate-600 capitalize">{account.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
