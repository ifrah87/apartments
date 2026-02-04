import { createTranslator } from "@/lib/i18n";

export default function BillsPage() {
  const t = createTranslator("en");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900">{t("sidebar.nav.bills")}</h1>
        <p className="text-sm text-slate-500">Invoices, collections, and billing performance.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Total invoiced", value: "$3,522.25" },
          { label: "Collected", value: "$0.00" },
          { label: "Outstanding", value: "$3,522.25" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-sm text-slate-500">Current period</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
            <p className="text-sm text-slate-500">Track outstanding balances and follow-ups.</p>
          </div>
          <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300">
            Generate invoices
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="text-slate-600">
                <td className="px-4 py-3 font-semibold text-slate-900">101</td>
                <td className="px-4 py-3">Ragsoor</td>
                <td className="px-4 py-3">Feb 2026</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">$522.25</td>
                <td className="px-4 py-3 text-right text-rose-600">$522.25</td>
              </tr>
              <tr className="text-slate-600">
                <td className="px-4 py-3 font-semibold text-slate-900">102</td>
                <td className="px-4 py-3">A1</td>
                <td className="px-4 py-3">Feb 2026</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">$3,000.00</td>
                <td className="px-4 py-3 text-right text-rose-600">$3,000.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
