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
  PencilLine,
  Plus,
} from "lucide-react";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";

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
  invoiceDate?: string;
  total: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
};

type DraftLineItem = {
  id: string;
  description: string;
  qty: number;
  unitCents: number;
  totalCents: number;
};

type DraftInvoice = {
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitLabel: string;
  period: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: DraftLineItem[];
  month: string;
  year: string;
};

type UnitRecord = {
  id: string;
  unit: string;
  property_id: string | null;
};

type TenantRecord = {
  id: string;
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
};

type LeaseRecord = {
  id: string;
  property?: string;
  unit: string;
  tenantName: string;
  status?: string;
  startDate?: string;
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

function formatCents(value: number) {
  return formatCurrency((value || 0) / 100);
}

function toCents(value: number) {
  return Math.round(Number(value || 0) * 100);
}

function parseInvoiceDate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = trimmed.length === 10 ? new Date(`${trimmed}T00:00:00Z`) : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInvoicePeriod(value?: string) {
  const date = parseInvoiceDate(value);
  if (!date) return "";
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function getInvoicePeriodLabel(invoice: InvoiceRow) {
  return formatInvoicePeriod(invoice.invoiceDate) || invoice.period || "";
}

function getInvoiceMonthYear(invoice: InvoiceRow) {
  const date = parseInvoiceDate(invoice.invoiceDate);
  if (date) {
    return {
      month: date.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
      year: String(date.getUTCFullYear()),
    };
  }
  const parts = (invoice.period || "").trim().split(" ");
  if (parts.length < 2) return { month: "", year: "" };
  const year = parts.pop() || "";
  const month = parts.join(" ");
  return { month, year };
}

function normalizeInvoice(row: any): InvoiceRow {
  const status = row?.status;
  const normalizedStatus: InvoiceRow["status"] =
    status === "Paid" || status === "Partially Paid" || status === "Unpaid" ? status : "Unpaid";
  const unitLabel = row?.unitLabel || row?.unit || row?.unit_name || "Unit";
  const tenantName = row?.tenantName || row?.tenant || "Tenant";
  const invoiceDate = row?.invoiceDate ?? row?.invoice_date ?? "";
  const period = formatInvoicePeriod(String(invoiceDate)) || String(row?.period ?? "");
  return {
    id: String(row?.id ?? ""),
    unitId: String(row?.unitId ?? row?.unit_id ?? ""),
    unitLabel: String(unitLabel),
    tenantId: String(row?.tenantId ?? row?.tenant_id ?? ""),
    tenantName: String(tenantName),
    period,
    invoiceDate: invoiceDate ? String(invoiceDate) : undefined,
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
  const [draftInvoice, setDraftInvoice] = useState<DraftInvoice | null>(null);
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [draftSaving, setDraftSaving] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [meterSnapshot, setMeterSnapshot] = useState<MeterSnapshot | null>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [unitsRes, tenantsRes, invoicesRes] = await Promise.all([
          fetch("/api/units", { cache: "no-store" }),
          fetch("/api/tenants", { cache: "no-store" }),
          fetch("/api/bills", { cache: "no-store" }),
        ]);
        const leasesRes = await fetch("/api/lease-agreements", { cache: "no-store" });
        const unitsPayload = await unitsRes.json().catch(() => null);
        const tenantsPayload = await tenantsRes.json().catch(() => null);
        const invoicesPayload = await invoicesRes.json().catch(() => null);
        const leasesPayload = await leasesRes.json().catch(() => null);
        const unitsData = unitsPayload?.ok ? unitsPayload.data : unitsPayload;
        const tenantsData = tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload;
        const invoicesData = invoicesPayload?.ok ? invoicesPayload.data : invoicesPayload;
        const leasesData = leasesPayload?.ok ? leasesPayload.data : leasesPayload;

        const tenantIndex = new Map<string, TenantRecord>();
        if (Array.isArray(tenantsData)) {
          tenantsData.forEach((tenant) => {
            const property = tenant.property_id || tenant.building || "";
            const unit = tenant.unit || "";
            if (!property || !unit) return;
            tenantIndex.set(`${property}::${unit}`.toLowerCase(), tenant);
          });
        }

        const leaseIndex = new Map<string, LeaseRecord>();
        if (Array.isArray(leasesData)) {
          leasesData
            .filter((lease) => String(lease?.status || "").toLowerCase() === "active")
            .forEach((lease) => {
              const unit = String(lease?.unit || "").trim();
              if (!unit) return;
              const property = String(lease?.property || "").trim().toLowerCase();
              const start = lease?.startDate ? new Date(lease.startDate).getTime() : 0;
              const key = `${property}::${unit}`.toLowerCase();
              const fallbackKey = `::${unit}`.toLowerCase();
              const existing = leaseIndex.get(key);
              if (!existing || start >= (existing.startDate ? new Date(existing.startDate).getTime() : 0)) {
                leaseIndex.set(key, lease);
              }
              const existingFallback = leaseIndex.get(fallbackKey);
              if (!existingFallback || start >= (existingFallback.startDate ? new Date(existingFallback.startDate).getTime() : 0)) {
                leaseIndex.set(fallbackKey, lease);
              }
            });
        }

        const nextUnits: UnitCard[] = Array.isArray(unitsData)
          ? unitsData.flatMap((unit: UnitRecord) => {
              const propertyId = String(unit.property_id || "").toLowerCase();
              const unitLabel = unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`;
              const lease =
                leaseIndex.get(`${propertyId}::${unit.unit}`.toLowerCase()) ||
                leaseIndex.get(`::${unit.unit}`.toLowerCase());
              if (!lease) return [];
              const tenant =
                lease.tenantName ||
                tenantIndex.get(`${propertyId}::${unit.unit}`.toLowerCase())?.name ||
                "No tenant";
              return [
                {
                  id: unit.id,
                  unit: unitLabel,
                  tenant,
                  hasTenant: true,
                },
              ];
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

  const computeTotal = (items: InvoiceLineItem[]) =>
    Number(items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));

  const createLineItem = (overrides?: Partial<InvoiceLineItem>): InvoiceLineItem => ({
    id: overrides?.id || (globalThis.crypto?.randomUUID?.() ?? `line-${Math.random().toString(36).slice(2)}`),
    description: overrides?.description ?? "",
    qty: overrides?.qty ?? 1,
    rate: overrides?.rate ?? 0,
    amount: overrides?.amount ?? 0,
  });

  const createDraftLineItem = (overrides?: Partial<DraftLineItem>): DraftLineItem => {
    const qty = Number(overrides?.qty ?? 1);
    const unitCents = Number(overrides?.unitCents ?? 0);
    return {
      id: overrides?.id || (globalThis.crypto?.randomUUID?.() ?? `draft-${Math.random().toString(36).slice(2)}`),
      description: overrides?.description ?? "",
      qty,
      unitCents,
      totalCents: Number(overrides?.totalCents ?? Math.round(qty * unitCents)),
    };
  };

  const normalizeSnapshot = (snapshot?: MeterSnapshot | null): MeterSnapshot => {
    if (snapshot) return snapshot;
    return {
      prevDate: "",
      prevReading: 0,
      currDate: "",
      currReading: 0,
      usage: 0,
      rate: 0.41,
      amount: 0,
      unitLabel: "kWh",
    };
  };

  const syncElectricityLine = (items: InvoiceLineItem[], snapshot: MeterSnapshot | null) => {
    if (!snapshot) return items;
    const next = [...items];
    const idx = next.findIndex((item) => item.description.toLowerCase().includes("electric"));
    const electricity = createLineItem({
      id: idx >= 0 ? next[idx].id : undefined,
      description: "Electricity",
      qty: snapshot.usage,
      rate: snapshot.rate,
      amount: snapshot.amount,
    });
    if (idx >= 0) next[idx] = electricity;
    else next.push(electricity);
    return next;
  };

  const openEditor = async (invoice: InvoiceRow) => {
    setEditingInvoice(invoice);
    setEditingLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json().catch(() => null);
        const data = payload?.ok ? payload.data : payload;
        const initialItems = Array.isArray(data?.line_items)
          ? data.line_items
          : [createLineItem({ description: "Monthly Rent", qty: 1, rate: invoice.total, amount: invoice.total })];
        const snapshot = normalizeSnapshot(data?.meter_snapshot ?? null);
        setMeterSnapshot(snapshot);
        setLineItems(syncElectricityLine(initialItems, snapshot));
        setEditingLoading(false);
        return;
      }
    } catch (err) {
      console.error("Failed to load invoice detail", err);
    }

    const fallbackItems = [createLineItem({ description: "Monthly Rent", qty: 1, rate: invoice.total, amount: invoice.total })];
    const snapshot = normalizeSnapshot(null);
    setMeterSnapshot(snapshot);
    setLineItems(syncElectricityLine(fallbackItems, snapshot));
    setEditingLoading(false);
  };

  const closeEditor = () => {
    setEditingInvoice(null);
    setLineItems([]);
    setMeterSnapshot(null);
    setEditingLoading(false);
    setEditingSaving(false);
  };

  const closeDraft = () => {
    setDraftInvoice(null);
    setDraftItems([]);
    setDraftSaving(false);
  };

  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: field === "description" ? String(value) : Number(value) };
        const qty = Number(next.qty || 0);
        const rate = Number(next.rate || 0);
        return { ...next, amount: Number((qty * rate).toFixed(2)) };
      }),
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createLineItem({ description: "", qty: 1, rate: 0, amount: 0 })]);
  };

  const updateDraftItem = (id: string, field: keyof DraftLineItem, value: string | number) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: field === "description" ? String(value) : Number(value),
        } as DraftLineItem;
        const qty = Number(next.qty || 0);
        const unitCents = Number(next.unitCents || 0);
        return { ...next, totalCents: Math.round(qty * unitCents) };
      }),
    );
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addDraftItem = () => {
    setDraftItems((prev) => [...prev, createDraftLineItem({ description: "", qty: 1, unitCents: 0 })]);
  };

  const updateSnapshot = (field: keyof MeterSnapshot, value: string | number) => {
    setMeterSnapshot((prev) => {
      const current = normalizeSnapshot(prev ?? null);
      const next = { ...current, [field]: field.includes("Date") ? String(value) : Number(value) };
      const usage = Math.max(Number(next.currReading || 0) - Number(next.prevReading || 0), 0);
      const rate = Number(next.rate || 0);
      const amount = Number((usage * rate).toFixed(2));
      next.usage = Number(usage.toFixed(2));
      next.amount = amount;
      setLineItems((items) => syncElectricityLine(items, next));
      return next;
    });
  };

  const saveInvoice = async () => {
    if (!editingInvoice) return;
    setEditingSaving(true);
    try {
      const res = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, meterSnapshot }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to save invoice.");
      }
      const totalAmount = payload?.data?.total_amount ?? computeTotal(lineItems);
      setInvoices((prev) =>
        prev.map((row) =>
          row.id === editingInvoice.id
            ? { ...row, total: Number(totalAmount), outstanding: Number(totalAmount) }
            : row,
        ),
      );
      closeEditor();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to save invoice.");
    } finally {
      setEditingSaving(false);
    }
  };

  const billingPeriod = useMemo(
    () => `${generatorMonth} ${generatorYear}`,
    [generatorMonth, generatorYear],
  );

  const billingUnits = useMemo<BillingUnit[]>(() => {
    const billedUnitIds = new Set(
      invoices.filter((invoice) => getInvoicePeriodLabel(invoice) === billingPeriod).map((invoice) => invoice.unitId),
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
    if (selectedUnits.length !== 1) {
      alert("Select a single unit to review before creating an invoice.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/bills?dryRun=1", {
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
        alert(payload?.error || "Failed to generate invoice preview.");
        setGenerating(false);
        return;
      }

      const draft = payload?.draft;
      if (!draft) {
        alert("No preview available.");
        setGenerating(false);
        return;
      }

      const draftItems = Array.isArray(draft.lineItems)
        ? draft.lineItems.map((item: any) =>
            createDraftLineItem({
              description: String(item?.description ?? ""),
              qty: Number(item?.qty ?? 0),
              unitCents: Number(item?.unit_cents ?? 0),
              totalCents: Number(item?.total_cents ?? 0),
            }),
          )
        : [];

      setDraftInvoice({
        tenantId: String(draft.tenantId || ""),
        tenantName: String(draft.tenantName || ""),
        unitId: String(draft.unitId || ""),
        unitLabel: String(draft.unitLabel || ""),
        period: String(draft.period || ""),
        invoiceDate: String(draft.invoiceDate || ""),
        dueDate: String(draft.dueDate || ""),
        lineItems: draftItems,
        month: generatorMonth,
        year: generatorYear,
      });
      setDraftItems(draftItems);
      setShowGenerator(false);
      setSelectedUnits([]);
    } catch (err) {
      console.error("Failed to generate invoice preview", err);
      alert("Failed to generate invoice preview.");
    } finally {
      setGenerating(false);
    }
  };

  const confirmDraft = async () => {
    if (!draftInvoice) return;
    setDraftSaving(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitIds: [draftInvoice.unitId],
          month: draftInvoice.month,
          year: draftInvoice.year,
          lineItems: draftItems.map((item) => ({
            description: item.description,
            qty: Number(item.qty || 0),
            unit_cents: Number(item.unitCents || 0),
            total_cents: Number(item.totalCents || 0),
          })),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Failed to create invoice.");
      }
      if (Array.isArray(payload?.data)) {
        setInvoices(payload.data.map(normalizeInvoice));
      } else {
        const reload = await fetch("/api/bills", { cache: "no-store" });
        const reloadPayload = await reload.json().catch(() => null);
        const reloadData = reloadPayload?.ok ? reloadPayload.data : reloadPayload;
        setInvoices(Array.isArray(reloadData) ? reloadData.map(normalizeInvoice) : []);
      }
      closeDraft();
    } catch (err) {
      console.error("Failed to create invoice", err);
      alert(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setDraftSaving(false);
    }
  };

  const buildInvoiceUrl = (invoice: InvoiceRow, mode: "pdf" | "download") => {
    const { month, year } = getInvoiceMonthYear(invoice);
    const params = new URLSearchParams({ mode });
    if (invoice.tenantId) params.set("tenantId", invoice.tenantId);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    return `/api/invoices/monthly?${params.toString()}`;
  };

  const handleViewInvoice = (invoice: InvoiceRow) => {
    window.open(buildInvoiceUrl(invoice, "pdf"), "_blank", "noopener,noreferrer");
  };

  const handleExportInvoice = (invoice: InvoiceRow) => {
    window.open(buildInvoiceUrl(invoice, "download"), "_blank", "noopener,noreferrer");
  };

  const handleWhatsAppInvoice = (invoice: InvoiceRow) => {
    const invoiceUrl = new URL(buildInvoiceUrl(invoice, "pdf"), window.location.origin).toString();
    const message = `Invoice for ${invoice.tenantName} (${getInvoicePeriodLabel(invoice)}) - ${formatCurrency(invoice.total)}. ${invoiceUrl}`;
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
                  <td className="px-4 py-3">{getInvoicePeriodLabel(invoice)}</td>
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
                        onClick={() => openEditor(invoice)}
                        className="rounded-lg border border-white/10 p-2 text-slate-200 hover:border-white/20"
                        title="Edit line items"
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
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

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              {!generatorUnits.length ? (
                <div className="col-span-full rounded-xl border border-white/10 bg-panel/60 p-4 text-sm text-slate-400">
                  No leased units available for billing.
                </div>
              ) : null}
              </div>
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
      {draftInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-accent">
                  <FileDown className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Review Invoice</h2>
                  <p className="text-xs text-slate-400">
                    {draftInvoice.unitLabel} • {draftInvoice.tenantName} • {draftInvoice.period}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDraft}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
              >
                <X className="h-3 w-3" />
                Close
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-white/10 bg-panel/70 p-4 text-xs text-slate-400">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Invoice Date</p>
                    <p className="mt-1 text-sm text-slate-100">{draftInvoice.invoiceDate}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Due Date</p>
                    <p className="mt-1 text-sm text-slate-100">{draftInvoice.dueDate}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Period</p>
                    <p className="mt-1 text-sm text-slate-100">{draftInvoice.period}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-panel/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Line Items</h3>
                    <p className="text-xs text-slate-400">Edit description, quantity, and unit price.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                  >
                    <Plus className="h-3 w-3" />
                    Add Line
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Unit Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {draftItems.map((item) => (
                        <tr key={item.id} className="border-t border-white/10">
                          <td className="px-3 py-2">
                            <input
                              value={item.description}
                              onChange={(event) => updateDraftItem(item.id, "description", event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(event) => updateDraftItem(item.id, "qty", event.target.value)}
                              className="w-24 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={(item.unitCents / 100).toFixed(2)}
                              onChange={(event) =>
                                updateDraftItem(item.id, "unitCents", toCents(Number(event.target.value)))
                              }
                              className="w-28 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-slate-100">
                            {formatCents(item.totalCents)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeDraftItem(item.id)}
                              className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-200"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!draftItems.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                            No line items yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-300">
                  Total Due:{" "}
                  <span className="font-semibold text-slate-100">
                    {formatCents(draftItems.reduce((sum, item) => sum + (item.totalCents || 0), 0))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={confirmDraft}
                  disabled={draftSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {draftSaving ? "Creating..." : "Confirm & Create Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {editingInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-accent">
                  <PencilLine className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Edit Invoice</h2>
                  <p className="text-xs text-slate-400">
                    {editingInvoice.unitLabel} • {editingInvoice.tenantName} • {getInvoicePeriodLabel(editingInvoice)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
              >
                <X className="h-3 w-3" />
                Close
              </button>
            </div>

            {editingLoading ? (
              <div className="mt-6 rounded-xl border border-white/10 bg-panel/70 p-6 text-sm text-slate-400">
                Loading invoice details...
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-white/10 bg-panel/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Line Items</h3>
                      <p className="text-xs text-slate-400">Edit description, quantity, and rate.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                    >
                      <Plus className="h-3 w-3" />
                      Add Line
                    </button>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Rate</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {lineItems.map((item) => (
                          <tr key={item.id} className="border-t border-white/10">
                            <td className="px-3 py-2">
                              <input
                                value={item.description}
                                onChange={(event) => updateLineItem(item.id, "description", event.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(event) => updateLineItem(item.id, "qty", event.target.value)}
                                className="w-24 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(event) => updateLineItem(item.id, "rate", event.target.value)}
                                className="w-28 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-100">
                              {formatCurrency(Number(item.amount || 0))}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-200"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!lineItems.length ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                              No line items yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-panel/70 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Electricity Meter Snapshot</h3>
                    <p className="text-xs text-slate-400">Update readings and rate (usage auto-calculates).</p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-xs text-slate-400">
                      Previous Reading Date
                      <input
                        type="date"
                        value={meterSnapshot?.prevDate ?? ""}
                        onChange={(event) => updateSnapshot("prevDate", event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Previous Reading
                      <input
                        type="number"
                        value={meterSnapshot?.prevReading ?? 0}
                        onChange={(event) => updateSnapshot("prevReading", event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Current Reading Date
                      <input
                        type="date"
                        value={meterSnapshot?.currDate ?? ""}
                        onChange={(event) => updateSnapshot("currDate", event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Current Reading
                      <input
                        type="number"
                        value={meterSnapshot?.currReading ?? 0}
                        onChange={(event) => updateSnapshot("currReading", event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Usage ({meterSnapshot?.unitLabel || "kWh"})
                      <input
                        type="number"
                        value={meterSnapshot?.usage ?? 0}
                        readOnly
                        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Rate
                      <input
                        type="number"
                        step="0.01"
                        value={meterSnapshot?.rate ?? 0}
                        onChange={(event) => updateSnapshot("rate", event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Electricity Amount
                      <input
                        type="number"
                        value={meterSnapshot?.amount ?? 0}
                        readOnly
                        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-300">
                    Total Due: <span className="font-semibold text-slate-100">{formatCurrency(computeTotal(lineItems))}</span>
                  </div>
                  <button
                    type="button"
                    onClick={saveInvoice}
                    disabled={editingSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editingSaving ? "Saving..." : "Save Invoice"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
