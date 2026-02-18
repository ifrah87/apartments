"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DEFAULT_LEASES, type LeaseAgreement } from "@/lib/leases";
import { FileDown, Search, Eye } from "lucide-react";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "danger" | "info"> = {
  Active: "success",
  Terminated: "danger",
  Pending: "warning",
};

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("en-GB");

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "Open Ended";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function buildCsv(rows: LeaseAgreement[]) {
  const header = [
    "Property",
    "Unit",
    "Tenant",
    "Status",
    "Start Date",
    "End Date",
    "Billing Cycle",
    "Rent",
    "Deposit",
  ];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.property || "",
        row.unit,
        row.tenantName,
        row.status,
        row.startDate,
        row.endDate || "",
        row.cycle,
        row.rent.toFixed(2),
        row.deposit.toFixed(2),
      ]
        .map((value) => `"${String(value).replace(/\"/g, '""')}"`)
        .join(","),
    );
  });
  return lines.join("\n");
}

function downloadCsv(rows: LeaseAgreement[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lease-statements-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSummaryHtml(rows: LeaseAgreement[]) {
  const tableRows = rows
    .map(
      (row) => `
      <tr>
        <td>${row.property || "—"}</td>
        <td>${row.unit}</td>
        <td>${row.tenantName}</td>
        <td>${row.status}</td>
        <td>${formatDate(row.startDate)}</td>
        <td>${row.endDate ? formatDate(row.endDate) : "Open Ended"}</td>
        <td>${row.cycle}</td>
        <td>${formatCurrency(row.rent)}</td>
        <td>${formatCurrency(row.deposit)}</td>
      </tr>
    `,
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Lease Statements</title>
      <style>
        body { font-family: "Inter", Arial, sans-serif; color: #0f172a; margin: 32px; }
        h1 { font-size: 22px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        th { background: #f1f5f9; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>Lease Statements</h1>
      <p>${new Date().toLocaleDateString()}</p>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Unit</th>
            <th>Tenant</th>
            <th>Status</th>
            <th>Start</th>
            <th>End</th>
            <th>Cycle</th>
            <th>Rent</th>
            <th>Deposit</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
  </html>`;
}

function openPrintWindow(rows: LeaseAgreement[]) {
  const html = buildSummaryHtml(rows);
  const win = window.open("", "_blank", "width=1280,height=720");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function LeaseStatementsReportPage() {
  const [leases, setLeases] = useState<LeaseAgreement[]>(DEFAULT_LEASES);
  const [properties, setProperties] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("All Properties");
  const [unitFilter, setUnitFilter] = useState("All Units");
  const [tenantFilter, setTenantFilter] = useState("All Tenants");

  useEffect(() => {
    fetch("/api/lease-agreements", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = (payload?.ok ? payload.data : payload) as LeaseAgreement[];
        if (Array.isArray(data) && data.length) setLeases(data);
      })
      .catch(() => setLeases(DEFAULT_LEASES));
  }, []);

  useEffect(() => {
    fetch("/api/properties", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = (payload?.ok ? payload.data : payload) as Array<{ name?: string; building?: string; property_id?: string }>;
        if (Array.isArray(data) && data.length) {
          const names = data
            .map((item) => item.name || item.building || item.property_id)
            .filter(Boolean) as string[];
          setProperties(Array.from(new Set(names)));
        }
      })
      .catch(() => {
        const fallback = leases.map((lease) => lease.property).filter(Boolean) as string[];
        setProperties(Array.from(new Set(fallback)));
      });
  }, [leases]);

  const propertyOptions = useMemo(() => {
    const fallback = leases.map((lease) => lease.property).filter(Boolean) as string[];
    return Array.from(new Set([...properties, ...fallback]));
  }, [properties, leases]);

  const unitOptions = useMemo(
    () => Array.from(new Set(leases.map((lease) => lease.unit).filter(Boolean))),
    [leases],
  );

  const tenantOptions = useMemo(
    () => Array.from(new Set(leases.map((lease) => lease.tenantName).filter(Boolean))),
    [leases],
  );

  const visibleLeases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leases.filter((lease) => {
      if (propertyFilter !== "All Properties" && lease.property !== propertyFilter) return false;
      if (unitFilter !== "All Units" && lease.unit !== unitFilter) return false;
      if (tenantFilter !== "All Tenants" && lease.tenantName !== tenantFilter) return false;
      if (!query) return true;
      return (
        lease.unit.toLowerCase().includes(query) ||
        lease.tenantName.toLowerCase().includes(query) ||
        (lease.property || "").toLowerCase().includes(query)
      );
    });
  }, [leases, search, propertyFilter, unitFilter, tenantFilter]);

  const activeCount = visibleLeases.filter((lease) => lease.status === "Active").length;
  const totalRent = visibleLeases.reduce((sum, lease) => sum + (lease.rent || 0), 0);
  const totalDeposits = visibleLeases.reduce((sum, lease) => sum + (lease.deposit || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease Statements"
        subtitle="Review and export lease summaries across your properties."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => openPrintWindow(visibleLeases)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button
              onClick={() => downloadCsv(visibleLeases)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="border-l-2 border-l-accent/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total Leases</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{visibleLeases.length}</p>
          <p className="mt-1 text-sm text-slate-400">In current filter</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-emerald-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active Leases</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{activeCount}</p>
          <p className="mt-1 text-sm text-slate-400">Currently occupied</p>
        </SectionCard>
        <SectionCard className="border-l-2 border-l-violet-400/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Gross Rent</p>
          <p className="mt-2 text-2xl font-semibold text-violet-200">{formatCurrency(totalRent)}</p>
          <p className="mt-1 text-sm text-slate-400">Deposits {formatCurrency(totalDeposits)}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel-2/60 px-4 py-3 text-sm text-slate-400">
            <Search className="h-4 w-4" />
            <input
              placeholder="Search property, unit, or tenant..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              Property
              <select
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
              >
                <option>All Properties</option>
                {propertyOptions.map((property) => (
                  <option key={property}>{property}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Unit
              <select
                value={unitFilter}
                onChange={(event) => setUnitFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
              >
                <option>All Units</option>
                {unitOptions.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Tenant
              <select
                value={tenantFilter}
                onChange={(event) => setTenantFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs text-slate-200"
              >
                <option>All Tenants</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant}>{tenant}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Rent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              {visibleLeases.map((lease) => (
                <tr key={lease.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 text-slate-200">{lease.property || "—"}</td>
                  <td className="px-4 py-3 text-slate-100">{lease.unit}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">{lease.tenantName}</div>
                    {lease.tenantPhone ? <div className="text-xs text-slate-400">{lease.tenantPhone}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[lease.status] || "info"}>{lease.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatDate(lease.startDate)}</td>
                  <td className="px-4 py-3">{lease.endDate ? formatDate(lease.endDate) : "Open Ended"}</td>
                  <td className="px-4 py-3">{lease.cycle}</td>
                  <td className="px-4 py-3 text-slate-100">{formatCurrency(lease.rent)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/reports/lease-statements/${lease.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-white/20"
                    >
                      <Eye className="h-4 w-4" />
                      View Statement
                    </Link>
                  </td>
                </tr>
              ))}
              {!visibleLeases.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    No leases found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
