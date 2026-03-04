"use client";

import { useState } from "react";
import type { ElementType } from "react";
import { Download, FileText, ClipboardList, Users2, Building2, Landmark, Gauge } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type ExportSource = {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  icon: ElementType;
  supportsDateRange?: boolean;
};

const EXPORTS: ExportSource[] = [
  {
    id: "tenants",
    label: "Tenant List",
    description: "All tenants and lease details.",
    endpoint: "/api/tenants",
    icon: Users2,
  },
  {
    id: "units",
    label: "Unit Inventory",
    description: "Units, status, and metadata.",
    endpoint: "/api/units",
    icon: Building2,
  },
  {
    id: "bank-transactions",
    label: "Bank Transactions",
    description: "Imported bank transactions.",
    endpoint: "/api/bank-transactions",
    icon: Landmark,
    supportsDateRange: true,
  },
  {
    id: "ledger",
    label: "Ledger Entries",
    description: "Ledger entries for the selected period.",
    endpoint: "/api/ledger",
    icon: FileText,
    supportsDateRange: true,
  },
  {
    id: "meter-readings",
    label: "Meter Readings",
    description: "Utility readings history.",
    endpoint: "/api/meter-readings",
    icon: Gauge,
  },
  {
    id: "services",
    label: "Services & Rates",
    description: "Building services and pricing.",
    endpoint: "/api/services",
    icon: ClipboardList,
  },
];

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvValue).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => csvValue(row[key])).join(","));
  });
  return lines.join("\n");
}

export default function ExportCentrePage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (source: ExportSource) => {
    setError(null);
    setLoadingId(source.id);
    try {
      const params = new URLSearchParams();
      if (source.supportsDateRange && start) params.set("start", start);
      if (source.supportsDateRange && end) params.set("end", end);
      const url = params.toString() ? `${source.endpoint}?${params.toString()}` : source.endpoint;
      const res = await fetch(url, { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Export failed.");
      }
      const rows = (payload?.ok ? payload.data : payload) as Record<string, unknown>[];
      if (!Array.isArray(rows)) {
        throw new Error("Export returned unexpected data.");
      }
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      link.href = href;
      link.download = `${source.id}-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Export Centre</h1>
        <p className="text-sm text-slate-400">Download standard CSV exports for reporting and audits.</p>
      </div>

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-end gap-4 text-sm text-slate-300">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Start date</label>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="mt-2 w-44 rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">End date</label>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="mt-2 w-44 rounded-lg border border-white/10 bg-panel-2/60 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <p className="text-xs text-slate-500">
            Date range applies to bank transactions and ledger exports.
          </p>
        </div>
      </SectionCard>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <SectionCard className="p-0">
        <div className="divide-y divide-white/10">
          {EXPORTS.map((source) => {
            const Icon = source.icon;
            return (
              <div key={source.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{source.label}</p>
                    <p className="text-xs text-slate-400">{source.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => download(source)}
                  disabled={loadingId === source.id}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_8px_16px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Download className="h-4 w-4" />
                  {loadingId === source.id ? "Preparing..." : "Export CSV"}
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
