"use client";

import { useEffect, useMemo, useState } from "react";
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
  hasTenant: boolean;
};

type BillingUnit = UnitCard & {
  status: "ready" | "billed" | "waiting";
};

type InvoiceRow = {
  id: string;
  unitId: string;
  unitLabel: string;
  tenantId: string;
  tenantName: string;
  period: string;
  total: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
};

type UnitRecord = {
  id: string;
  unit: string;
  property_id?: string | null;
};

type TenantRecord = {
  id: string;
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
};

const STATUS_VARIANTS: Record<InvoiceRow["status"], "success" | "warning" | "danger"> = {
  Paid: "success",
  "Partially Paid": "warning",
  Unpaid: "danger",
};

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

function normalizeInvoice(row: any): InvoiceRow {
  const status = row?.status;
  const normalizedStatus: InvoiceRow["status"] =
    status === "Paid" || status === "Partially Paid" || status === "Unpaid" ? status : "Unpaid";
  const unitLabel = row?.unitLabel || row?.unit || row?.unit_name || "Unit";
  const tenantName = row?.tenantName || row?.tenant || "Tenant";
  return {
    id: String(row?.id ?? ""),
    unitId: String(row?.unitId ?? row?.unit_id ?? ""),
    unitLabel: String(unitLabel),
    tenantId: String(row?.tenantId ?? row?.tenant_id ?? ""),
    tenantName: String(tenantName),
    period: String(row?.period ?? ""),
    total: Number(row?.total ?? 0),
    outstanding: Number(row?.outstanding ?? row?.total ?? 0),
    status: normalizedStatus,
  };
}

export default function BillsPage() {
  const [query, setQuery] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [units, setUnits] = useState<UnitCard[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorQuery, setGeneratorQuery] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatorMonth, setGeneratorMonth] = useState("February");
  const [generatorYear, setGeneratorYear] = useState("2026");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [unitsRes, tenantsRes, invoicesRes] = await Promise.all([
          fetch("/api/units", { cache: "no-store" }),
          fetch("/api/tenants", { cache: "no-store" }),
          fetch("/api/bills", { cache: "no-store" }),
        ]);
        const unitsPayload = await unitsRes.json().catch(() => null);
        const tenantsPayload = await tenantsRes.json().catch(() => null);
        const invoicesPayload = await invoicesRes.json().catch(() => null);
        const unitsData = unitsPayload?.ok ? unitsPayload.data : unitsPayload;
        const tenantsData = tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload;
        const invoicesData = invoicesPayload?.ok ? invoicesPayload.data : invoicesPayload;

        const tenantIndex = new Map<string, TenantRecord>();
        if (Array.isArray(tenantsData)) {
          tenantsData.forEach((tenant) => {
            const property = tenant.property_id || tenant.building || "";
            const unit = tenant.unit || "";
            if (!property || !unit) return;
            tenantIndex.set(`${property}::${unit}`.toLowerCase(), tenant);
          });
        }

        const nextUnits: UnitCard[] = Array.isArray(unitsData)
          ? unitsData.map((unit: UnitRecord) => {
              const propertyId = unit.property_id || "";
              const tenant = tenantIndex.get(`${propertyId}::${unit.unit}`.toLowerCase());
              return {
                id: unit.id,
                unit: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
                tenant: tenant?.name || "No tenant",
                hasTenant: Boolean(tenant),
              };
            })
          : [];

        setUnits(nextUnits);
        setInvoices(Array.isArray(invoicesData) ? invoicesData.map(normalizeInvoice) : []);
      } catch (err) {
        console.error("Failed to load units for billing", err);
        setUnits([]);
        setInvoices([]);
      }
    };

    loadData();
  }, []);

  const billingPeriod = useMemo(
    () => `${generatorMonth} ${generatorYear}`,
    [generatorMonth, generatorYear],
  );

  const billingUnits = useMemo<BillingUnit[]>(() => {
    const billedUnitIds = new Set(
      invoices.filter((invoice) => invoice.period === billingPeriod).map((invoice) => invoice.unitId),
    );
    return units.map((unit) => ({
      ...unit,
      status: unit.hasTenant ? (billedUnitIds.has(unit.id) ? "billed" : "ready") : "waiting",
    }));
  }, [units, invoices, billingPeriod]);

  const visibleInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((invoice) => {
      return (
        invoice.unitLabel.toLowerCase().includes(normalized) ||
        invoice.tenantName.toLowerCase().includes(normalized)
      );
    });
  }, [query, invoices]);

  const handleDeleteInvoice = async (invoice: InvoiceRow) => {
    if (!confirm(`Delete invoice for ${invoice.unitLabel}?`)) return;
    try {
      const res = await fetch("/api/bills", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        alert(payload?.error || "Failed to delete invoice.");
        return;
      }
        const data = payload?.data;
        if (Array.isArray(data)) {
          setInvoices(data.map(normalizeInvoice));
        } else {
          setInvoices((prev) => prev.filter((row) => row.id !== invoice.id));
        }
    } catch (err) {
      console.error("Failed to delete invoice", err);
      alert("Failed to delete invoice.");
    }
  };

  const generatorUnits = useMemo(() => {
    const normalized = generatorQuery.trim().toLowerCase();
    if (!normalized) return billingUnits;
    return billingUnits.filter((unit) => {
      return unit.unit.toLowerCase().includes(normalized) || unit.tenant.toLowerCase().includes(normalized);
    });
  }, [generatorQuery, billingUnits]);

  const readyUnitIds = useMemo(
    () => billingUnits.filter((unit) => unit.status === "ready").map((unit) => unit.id),
    [billingUnits],
  );

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

  const toggleUnit = (unit: BillingUnit) => {
    if (unit.status !== "ready") return;
    setSelectedUnits((prev) => (prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id]));
  };

  const selectAllReady = () => {
    setSelectedUnits(readyUnitIds);
  };

  const runGenerator = async () => {
    if (!selectedUnits.length) return;
    setGenerating(true);
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitIds: selectedUnits,
          month: generatorMonth,
          year: generatorYear,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        popup?.close();
        alert(payload?.error || "Failed to generate invoices.");
        setGenerating(false);
        return;
      }

      if (Array.isArray(payload?.data)) {
        setInvoices(payload.data.map(normalizeInvoice));
      }

      if (Array.isArray(payload?.skipped) && payload.skipped.length) {
        alert(`Skipped: ${payload.skipped.join(", ")}`);
      }

      const params = new URLSearchParams({
        mode: "view",
        month: generatorMonth,
        year: generatorYear,
      });
      if (popup) {
        popup.location.href = `/api/invoices/monthly?${params.toString()}`;
      } else {
        window.open(`/api/invoices/monthly?${params.toString()}`, "_blank", "noopener,noreferrer");
      }
      setSelectedUnits([]);
      setShowGenerator(false);
    } catch (err) {
      console.error("Failed to generate invoices", err);
      popup?.close();
      alert("Failed to generate invoices.");
    } finally {
      setGenerating(false);
    }
  };

  const parsePeriod = (period: string) => {
    const parts = period.trim().split(" ");
    if (parts.length < 2) return { month: "", year: "" };
    const year = parts.pop() || "";
    const month = parts.join(" ");
    return { month, year };
  };

  const buildInvoiceUrl = (invoice: InvoiceRow, mode: "view" | "download") => {
    const { month, year } = parsePeriod(invoice.period);
    const params = new URLSearchParams({ mode });
    if (invoice.tenantId) params.set("tenantId", invoice.tenantId);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    return `/api/invoices/monthly?${params.toString()}`;
  };

  const handleViewInvoice = (invoice: InvoiceRow) => {
    window.open(buildInvoiceUrl(invoice, "view"), "_blank", "noopener,noreferrer");
  };

  const handleExportInvoice = (invoice: InvoiceRow) => {
    window.open(buildInvoiceUrl(invoice, "download"), "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppInvoice = (invoice: InvoiceRow) => {
    const invoiceUrl = new URL(buildInvoiceUrl(invoice, "view"), window.location.origin).toString();
    const message = `Invoice for ${invoice.tenantName} (${invoice.period}) - ${formatCurrency(invoice.total)}. ${invoiceUrl}`;
    const href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(href, "_blank", "noopener,noreferrer");
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
                    <div className="font-semibold text-slate-100">{invoice.unitLabel}</div>
                    <div className="text-xs text-slate-400">{invoice.tenantName}</div>
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
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleExportInvoice(invoice)}
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                      >
                        <FileDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleWhatsAppInvoice(invoice)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                      >
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
