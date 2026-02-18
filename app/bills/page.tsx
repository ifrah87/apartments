"use client";

import { useMemo, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import {
  FileDown,
  Search,
  Eye,
  MessageCircle,
  Trash2,
  CheckSquare2,
  X,
} from "lucide-react";

type UnitCard = {
  id: string;
  unit: string;
  tenant: string;
  status: "ready" | "billed" | "waiting";
};

type InvoiceRow = {
  id: string;
  unit: string;
  tenant: string;
  period: string;
  total: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
};

const UNITS: UnitCard[] = [
  { id: "101", unit: "Unit 101", tenant: "Jama", status: "billed" },
  { id: "102", unit: "Unit 102", tenant: "A1", status: "billed" },
  { id: "b1", unit: "Unit B1", tenant: "Abdirizak Xiin", status: "billed" },
  { id: "c1", unit: "Unit C1", tenant: "Haji", status: "billed" },
  { id: "103", unit: "Unit 103", tenant: "103", status: "billed" },
  { id: "1003", unit: "Unit 1003", tenant: "Mahamud", status: "waiting" },
];

const INVOICES: InvoiceRow[] = [
  { id: "inv-101-mar", unit: "Unit 101", tenant: "Jama", period: "March 2026", total: 212.82, outstanding: 212.82, status: "Unpaid" },
  { id: "inv-103-mar", unit: "Unit 103", tenant: "103", period: "March 2026", total: 100, outstanding: 100, status: "Unpaid" },
  { id: "inv-b1-mar", unit: "Unit B1", tenant: "Abdirizak Xiin", period: "March 2026", total: 1005, outstanding: 1005, status: "Unpaid" },
  { id: "inv-101-feb", unit: "Unit 101", tenant: "Jama", period: "February 2026", total: 522.25, outstanding: 0, status: "Paid" },
  { id: "inv-102-feb", unit: "Unit 102", tenant: "A1", period: "February 2026", total: 3000, outstanding: 1700, status: "Partially Paid" },
  { id: "inv-c1-feb", unit: "Unit C1", tenant: "Haji", period: "February 2026", total: 1538.2, outstanding: 1538.2, status: "Unpaid" },
  { id: "inv-103-feb", unit: "Unit 103", tenant: "103", period: "February 2026", total: 100, outstanding: 100, status: "Unpaid" },
];

const STATUS_VARIANTS: Record<InvoiceRow["status"], "success" | "warning" | "danger"> = {
  Paid: "success",
  "Partially Paid": "warning",
  Unpaid: "danger",
};

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

export default function BillsPage() {
  const [query, setQuery] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>(INVOICES);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorQuery, setGeneratorQuery] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatorMonth, setGeneratorMonth] = useState("February");
  const [generatorYear, setGeneratorYear] = useState("2026");

  const visibleInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((invoice) => {
      return (
        invoice.unit.toLowerCase().includes(normalized) ||
        invoice.tenant.toLowerCase().includes(normalized)
      );
    });
  }, [query, invoices]);

  const handleDeleteInvoice = (invoice: InvoiceRow) => {
    if (!confirm(`Delete invoice for ${invoice.unit}?`)) return;
    setInvoices((prev) => prev.filter((row) => row.id !== invoice.id));
  };

  const generatorUnits = useMemo(() => {
    const normalized = generatorQuery.trim().toLowerCase();
    if (!normalized) return UNITS;
    return UNITS.filter((unit) => {
      return unit.unit.toLowerCase().includes(normalized) || unit.tenant.toLowerCase().includes(normalized);
    });
  }, [generatorQuery]);

  const readyUnitIds = useMemo(() => UNITS.filter((unit) => unit.status === "ready").map((unit) => unit.id), []);

  const openGenerator = () => {
    setShowGenerator(true);
    setGeneratorQuery("");
    setSelectedUnits([]);
    setGenerating(false);
  };

  const closeGenerator = () => {
    setShowGenerator(false);
    setGenerating(false);
  };

  const toggleUnit = (unit: UnitCard) => {
    if (unit.status !== "ready") return;
    setSelectedUnits((prev) => (prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id]));
  };

  const selectAllReady = () => {
    setSelectedUnits(readyUnitIds);
  };

  const runGenerator = () => {
    if (!selectedUnits.length) return;
    setGenerating(true);
    const popup = window.open("/api/invoices/monthly?mode=view", "_blank", "noopener,noreferrer");
    if (!popup) {
      alert("Popup blocked. Please allow popups to preview invoices.");
      setGenerating(false);
      return;
    }
    setTimeout(() => {
      setGenerating(false);
      setShowGenerator(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        subtitle="Generate invoices and review the latest billing history."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search by Unit # or Tenant..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={openGenerator}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
        >
          <FileDown className="h-4 w-4" />
          Generate Invoices
        </button>
      </div>

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
                <option>March</option>
                <option>February</option>
                <option>January</option>
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
              {visibleInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">{invoice.unit}</div>
                    <div className="text-xs text-slate-400">{invoice.tenant}</div>
                  </td>
                  <td className="px-4 py-3">{invoice.period}</td>
                  <td className="px-4 py-3 text-slate-100">{formatCurrency(invoice.total)}</td>
                  <td
                    className={`px-4 py-3 ${
                      invoice.outstanding > 0 ? "text-rose-200" : "text-emerald-200"
                    }`}
                  >
                    {formatCurrency(invoice.outstanding)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[invoice.status]}>{invoice.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20">
                        <FileDown className="h-4 w-4" />
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        className="rounded-full bg-rose-500/15 p-2 text-rose-200"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleInvoices.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No invoices available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {showGenerator ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-accent">
                  <CheckSquare2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Bill Generator</h2>
                  <p className="text-xs text-slate-400">Select units ready for {generatorMonth} {generatorYear}.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeGenerator}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3 text-sm text-slate-400">
                <Search className="h-4 w-4" />
                <input
                  placeholder="Search by Unit # or Tenant..."
                  value={generatorQuery}
                  onChange={(event) => setGeneratorQuery(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  Month
                  <select
                    value={generatorMonth}
                    onChange={(event) => setGeneratorMonth(event.target.value)}
                    className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
                  >
                    <option>January</option>
                    <option>February</option>
                    <option>March</option>
                    <option>April</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Year
                  <select
                    value={generatorYear}
                    onChange={(event) => setGeneratorYear(event.target.value)}
                    className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
                  >
                    <option>2026</option>
                    <option>2025</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={selectAllReady}
                  className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Select All Ready
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {generatorUnits.map((unit) => {
                const selectable = unit.status === "ready";
                const selected = selectedUnits.includes(unit.id);
                const statusLabel =
                  unit.status === "waiting"
                    ? "Missing Meter Reading"
                    : unit.status === "billed"
                      ? "Already Billed"
                      : "Ready";
                const statusColor =
                  unit.status === "waiting"
                    ? "text-rose-300"
                    : unit.status === "billed"
                      ? "text-emerald-300"
                      : "text-emerald-200";
                const dotColor = unit.status === "waiting" ? "bg-rose-400" : "bg-emerald-400";

                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => toggleUnit(unit)}
                    className={`flex w-full items-start justify-between rounded-xl border border-white/10 bg-panel/70 p-3 text-left transition ${
                      selectable ? "hover:border-accent/60" : "cursor-not-allowed opacity-80"
                    } ${selected ? "border-accent/70 bg-accent/10" : ""}`}
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{unit.unit}</p>
                      <p className="text-sm font-semibold text-slate-100">{unit.tenant}</p>
                      <p className={`mt-2 flex items-center gap-2 text-xs ${statusColor}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                        {statusLabel}
                      </p>
                    </div>
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border ${
                        selected ? "border-accent bg-accent/20 text-accent" : "border-white/10 text-slate-400"
                      }`}
                    >
                      {selected ? <CheckSquare2 className="h-3 w-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Ready
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Waiting for Meter
                </span>
              </div>
              <button
                type="button"
                onClick={runGenerator}
                disabled={!selectedUnits.length || generating}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" />
                {generating
                  ? "Generating..."
                  : `Generate ${selectedUnits.length} Invoice${selectedUnits.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
