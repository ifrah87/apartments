import { createTranslator } from "@/lib/i18n";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { FileDown, Plus, Search, CreditCard, Trash2, Eye } from "lucide-react";

const invoices = [
  {
    id: "inv-101",
    tenantId: "101",
    unit: "101",
    tenant: "Ragsoor",
    period: "February 2026",
    total: 522.25,
    outstanding: 522.25,
    status: "Unpaid",
  },
  {
    id: "inv-102",
    tenantId: "102",
    unit: "102",
    tenant: "A1",
    period: "February 2026",
    total: 3000,
    outstanding: 3000,
    status: "Unpaid",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function BillsPage() {
  const t = createTranslator("en");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Invoices"
        subtitle="Generate and track monthly tenant invoices."
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20">
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong">
              <Plus className="h-4 w-4" />
              Generate Invoices
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="border-l-2 border-l-accent/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total invoiced</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatCurrency(3522.25)}</p>
          <p className="mt-1 text-sm text-slate-400">Current period</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-emerald-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Collected</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatCurrency(0)}</p>
          <p className="mt-1 text-sm text-slate-400">Current period</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-rose-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold text-rose-200">{formatCurrency(3522.25)}</p>
          <p className="mt-1 text-sm text-slate-400">Current period</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search invoices by unit or tenant name..."
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
      </SectionCard>

      <SectionCard className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-accent">
              <FileDown className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Recent Invoices History</h2>
              <p className="text-xs text-slate-400">Monthly tenant invoices and payment status.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              Month
              <select className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200">
                <option>All Months</option>
                <option>January</option>
                <option>February</option>
                <option>March</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Year
              <select className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200">
                <option>2026</option>
                <option>2025</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Unit / Tenant</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">Unit {invoice.unit}</div>
                    <div className="text-xs text-slate-400">{invoice.tenant}</div>
                  </td>
                  <td className="px-4 py-3">{invoice.period}</td>
                  <td className="px-4 py-3 text-slate-100">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3 text-rose-200">{formatCurrency(invoice.outstanding)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="danger">{invoice.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/invoices/monthly?mode=view&tenantId=${encodeURIComponent(invoice.tenantId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                        aria-label={`View invoice for Unit ${invoice.unit}`}
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <a
                        href={`/api/invoices/monthly?mode=download&tenantId=${encodeURIComponent(invoice.tenantId)}`}
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                        aria-label={`Download invoice for Unit ${invoice.unit}`}
                      >
                        <FileDown className="h-4 w-4" />
                      </a>
                      <button className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        WhatsApp
                      </button>
                      <button className="rounded-md bg-rose-500/15 px-2 py-1 text-rose-200">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!invoices.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No invoices available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
