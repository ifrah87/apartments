import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { dateOnlyToUtcTimestamp, toDateOnlyString } from "@/lib/dateOnly";
import { query } from "@/lib/db";
import { isUuid } from "@/lib/isUuid";
import { datasetsRepo, tenantsRepo } from "@/lib/repos";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";
import { normalizeId } from "@/lib/reports/tenantStatement";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { opt } from "@/src/lib/utils/normalize";
import { buildCompanyProfile, getOrganizationSnapshot, type CompanyProfile } from "@/lib/settings/organization";

export const runtime = "nodejs";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FALLBACK_COMPANY: CompanyProfile = {
  name: "Orfane Tower",
  address: "",
  phone: "",
  logoPath: "/branding/Logo.png",
  paymentLines: [
    "Bank: Salaam Bank",
    "Account Name: Ahmed Awale Sabriyee",
    "Account No: 32191089",
  ],
  paymentInstructions: "Please use your Unit + Name as the payment reference.",
};

type InvoiceHeaderRow = {
  id: string;
  tenant_id: string | null;
  unit_id: string | null;
  invoice_number: string | null;
  invoice_date: string | Date | null;
  due_date: string | Date | null;
  status: string | null;
  currency: string | null;
  notes: string | null;
  meta: Record<string, any> | null;
  period?: string | null;
  line_items?: InvoiceLineItem[] | null;
  meter_snapshot?: Record<string, any> | null;
};

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  meta?: Record<string, unknown> | null;
  created_at?: string;
};

type UnitLookupRow = {
  id: string;
  property_id: string | null;
  unit_number: string | number | null;
};

type InitialReadingRecord = {
  unit?: string;
  unit_id?: string | null;
  meter_type?: string;
  reading_value?: number | string;
  reading_date?: string;
  updated_at?: string;
  baseline?: boolean;
};

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function fromCents(value: number | null | undefined) {
  return Number(((value ?? 0) / 100).toFixed(2));
}

function formatUkDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function normalizeSnapshotDate(value: unknown) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw === "Initial") return "Initial";
  return toDateOnlyString(raw);
}

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function monthStartExclusiveRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const nextStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
  return { start, nextStart };
}

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toMonthIndex(value: string) {
  const idx = MONTHS.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return idx >= 0 ? idx : null;
}

function dueDateForMonth(reference: Date, dueDayRaw: string | number | null | undefined) {
  const dueDay = Math.max(1, Number(dueDayRaw || 1));
  const dim = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), Math.min(dueDay, dim)));
}

function toNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapLineItems(rows: InvoiceLineItem[]): InvoiceLineItem[] {
  return rows
    .map((row, idx) => ({
      id: String((row as any)?.id ?? `line-${idx + 1}`),
      description: String((row as any)?.description ?? ""),
      qty: Number((row as any)?.qty ?? 0),
      rate: Number((row as any)?.rate ?? 0),
      amount: Number((row as any)?.amount ?? 0),
      meta: (row as any)?.meta && typeof (row as any).meta === "object" ? (row as any).meta : undefined,
    }))
    .filter((row) => row.description);
}

function mapStoredLineItems(input: unknown): InvoiceLineItem[] {
  return Array.isArray(input) ? mapLineItems(input as InvoiceLineItem[]) : [];
}

function mapInvoiceLineRows(rows: InvoiceLineRow[]): InvoiceLineItem[] {
  return rows
    .map((row, idx) => ({
      id: String(row.id || `line-${idx + 1}`),
      description: String(row.description || ""),
      qty: Number(row.quantity || 0),
      rate: fromCents(row.unit_price_cents),
      amount: fromCents(row.total_cents),
      meta: row.meta && typeof row.meta === "object" ? row.meta : undefined,
    }))
    .filter((row) => row.description);
}

function normalizeMeterSnapshot(input: unknown): MeterSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const snap = input as any;
  const prevReading = Number(snap.prevReading ?? snap.prev ?? snap.prev_reading ?? 0);
  const currReading = Number(snap.currReading ?? snap.cur ?? snap.cur_reading ?? 0);
  const usage = Number(Math.max(currReading - prevReading, 0).toFixed(2));
  const rate = Number(snap.rate ?? snap.unit_rate ?? 0.41);
  const amount = Number((usage * rate).toFixed(2));
  return {
    prevDate: normalizeSnapshotDate(snap.prevDate ?? snap.prev_date),
    prevReading,
    currDate: normalizeSnapshotDate(snap.currDate ?? snap.cur_date),
    currReading,
    usage,
    rate,
    amount,
    unitLabel: snap.unitLabel ? String(snap.unitLabel) : snap.unit_label ? String(snap.unit_label) : "kWh",
  };
}

function extractMeterSnapshot(rows: InvoiceLineRow[]): MeterSnapshot | null {
  return null;
}


type InvoicePayload = {
  tenant: TenantRecord;
  propertyLabel: string;
  invoiceId: string;
  line_items: InvoiceLineItem[];
  meter_snapshot: MeterSnapshot | null;
  total_amount: number;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
};

type InvoiceLineDisplay = {
  title: string;
  subtitle: string;
};

type InvoiceSummaryRow = {
  label: string;
  amount: number;
};

const propertyLabelCache = new Map<string, string>();

async function resolvePropertyLabel(propertyId?: string | null, building?: string | null) {
  const normalizedPropertyId = String(propertyId || "").trim();
  const normalizedBuilding = String(building || "").trim();
  const cacheKey = `${normalizedPropertyId}::${normalizedBuilding}`;
  const cached = propertyLabelCache.get(cacheKey);
  if (cached) return cached;

  if (normalizedPropertyId) {
    try {
      const res = await query<{ name: string | null }>(
        `SELECT name
         FROM public.properties
         WHERE id = $1
         LIMIT 1`,
        [normalizedPropertyId],
      );
      const name = String(res.rows[0]?.name || "").trim();
      if (name) {
        propertyLabelCache.set(cacheKey, name);
        return name;
      }
    } catch (err) {
      console.warn("Failed to resolve property label for invoice export:", err);
    }
  }

  const fallback = normalizedBuilding && !isUuid(normalizedBuilding) ? normalizedBuilding : "—";
  propertyLabelCache.set(cacheKey, fallback);
  return fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTemplateDate(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value === "Initial") return "Initial";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function describeLineItem(item: InvoiceLineItem): InvoiceLineDisplay {
  const description = String(item.description || "").trim();
  if (!description) {
    return { title: "", subtitle: "" };
  }

  const meterMeta = item.meta && typeof item.meta === "object" ? item.meta : null;
  if (meterMeta?.kind === "METER_ELECTRICITY") {
    const prev = meterMeta.prev ?? null;
    const cur = meterMeta.cur ?? null;
    const usage = Number(meterMeta.usage ?? item.qty ?? 0);
    const unitRate = Number(meterMeta.unit_rate ?? item.rate ?? 0);
    const prevText = prev === null ? "Initial missing" : `${formatQuantity(Number(prev))} kWh`;
    const curText = cur === null ? "Current missing" : `${formatQuantity(Number(cur))} kWh`;
    return {
      title: "Electricity",
      subtitle: `${formatQuantity(usage)} kWh × ${toMoney(unitRate)} — from meter readings`,
    };
  }

  const rentMatch = description.match(/^Monthly Rent \((.+)\)$/i);
  if (rentMatch) {
    return {
      title: "Monthly Rent",
      subtitle: rentMatch[1],
    };
  }

  const genericPeriodMatch = description.match(/^(.+?) \(([^)]+)\)$/);
  if (genericPeriodMatch) {
    return {
      title: genericPeriodMatch[1].trim(),
      subtitle: genericPeriodMatch[2].trim(),
    };
  }

  const parts = description.split("|").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return { title: description, subtitle: "" };
  }
  return {
    title: parts[0],
    subtitle: parts.slice(1).join(" | "),
  };
}

function extractBillingPeriodSubtitle(issueDate: Date) {
  return monthLabel(issueDate);
}

function summarizeLineItems(lineItems: InvoiceLineItem[]): InvoiceSummaryRow[] {
  const totals = new Map<string, number>();
  lineItems.forEach((item) => {
    const display = describeLineItem(item);
    const label = display.title || String(item.description || "").trim() || "Other";
    const amount = Number(item.amount || 0);
    totals.set(label, Number(((totals.get(label) || 0) + amount).toFixed(2)));
  });
  return Array.from(totals.entries()).map(([label, amount]) => ({
    label,
    amount: Number(amount.toFixed(2)),
  }));
}

function paymentBoxContent(company: CompanyProfile) {
  const lines = Array.isArray(company.paymentLines) ? company.paymentLines.filter(Boolean) : [];
  const instructions = String(company.paymentInstructions || "").trim();
  return {
    lines,
    instructions,
    visible: lines.length > 0 || Boolean(instructions),
  };
}

function deriveMeterSnapshotFromLineItems(lineItems: InvoiceLineItem[], existing: MeterSnapshot | null) {
  if (existing) return existing;
  const electricityItem = lineItems.find((item) => {
    const meta = item.meta && typeof item.meta === "object" ? item.meta : null;
    return meta?.kind === "METER_ELECTRICITY" || /electric/i.test(String(item.description || ""));
  });
  if (!electricityItem) return null;
  const meta = electricityItem.meta && typeof electricityItem.meta === "object" ? electricityItem.meta : {};
  const prevReading = Number((meta as any).prev ?? 0);
  const currReading = Number((meta as any).cur ?? 0);
  const usage = Number((meta as any).usage ?? electricityItem.qty ?? Math.max(currReading - prevReading, 0));
  const rate = Number((meta as any).unit_rate ?? electricityItem.rate ?? 0.41);
  return {
    prevDate: normalizeSnapshotDate((meta as any).prev_date ?? ((meta as any).sourcePrev === "baseline" ? "Initial" : "")),
    prevReading,
    currDate: normalizeSnapshotDate((meta as any).curr_date ?? ""),
    currReading,
    usage,
    rate,
    amount: Number((usage * rate).toFixed(2)),
    unitLabel: "kWh",
  };
}

function isMeterSnapshotComplete(snapshot: MeterSnapshot | null) {
  if (!snapshot) return false;
  const hasPrev = snapshot.prevDate || snapshot.prevReading || snapshot.prevReading === 0;
  const hasCur = snapshot.currDate || snapshot.currReading || snapshot.currReading === 0;
  return Boolean(hasPrev && hasCur);
}

function getInvoiceReference(invoice: InvoiceHeaderRow, fallbackReference: Date) {
  if (invoice.period) {
    const match = String(invoice.period).match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      if (Number.isFinite(year) && Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
        return new Date(Date.UTC(year, monthIndex, 1));
      }
    }
  }
  return invoice.invoice_date ? new Date(invoice.invoice_date) : fallbackReference;
}

async function fetchInitialElectricityReading(unitNumber: string, unitId?: string | null) {
  const raw = await datasetsRepo.getDataset<InitialReadingRecord[]>("initial-readings", []);
  const rows = Array.isArray(raw) ? raw : [];
  const matches = rows.filter((row) => {
    const meterType = String(row?.meter_type ?? "electricity").toLowerCase();
    if (meterType !== "electricity") return false;
    const rowUnit = row?.unit !== undefined && row?.unit !== null ? String(row.unit).trim() : "";
    const rowUnitId = row?.unit_id !== undefined && row?.unit_id !== null ? String(row.unit_id).trim() : "";
    if (unitId && rowUnitId && rowUnitId === unitId) return true;
    return rowUnit === unitNumber;
  });
  if (!matches.length) return null;
  const sorted = matches.slice().sort((a, b) => {
    const aDate = dateOnlyToUtcTimestamp(a.reading_date || a.updated_at || "") || 0;
    const bDate = dateOnlyToUtcTimestamp(b.reading_date || b.updated_at || "") || 0;
    return bDate - aDate;
  });
  const entry = sorted[0];
  const value = toNumberOrNull(entry?.reading_value);
  if (value === null) return null;
  return {
    value,
    date: normalizeSnapshotDate(entry?.reading_date || entry?.updated_at || ""),
  };
}

async function fetchMeterSnapshotFromReadings(input: {
  unit: UnitLookupRow | null;
  invoice: InvoiceHeaderRow;
  lineItems: InvoiceLineItem[];
  fallbackReference: Date;
}) {
  const unitNumber =
    input.unit?.unit_number !== undefined && input.unit?.unit_number !== null ? String(input.unit.unit_number).trim() : "";
  if (!unitNumber) return null;

  const reference = getInvoiceReference(input.invoice, input.fallbackReference);
  const { start, nextStart } = monthStartExclusiveRange(reference);
  const [prevRes, curRes] = await Promise.all([
    query<{ reading_value: number | string; reading_date: string | Date }>(
      `SELECT reading_value, reading_date
       FROM public.meter_readings
       WHERE unit = $1
         AND lower(meter_type) = 'electricity'
         AND reading_date < $2
       ORDER BY reading_date DESC, created_at DESC
       LIMIT 1`,
      [unitNumber, toISO(start)],
    ),
    query<{ reading_value: number | string; reading_date: string | Date }>(
      `SELECT reading_value, reading_date
       FROM public.meter_readings
       WHERE unit = $1
         AND lower(meter_type) = 'electricity'
         AND reading_date >= $2
         AND reading_date < $3
       ORDER BY reading_date DESC, created_at DESC
       LIMIT 1`,
      [unitNumber, toISO(start), toISO(nextStart)],
    ),
  ]);

  const curRow = curRes.rows[0];
  const curReading = toNumberOrNull(curRow?.reading_value);
  if (curReading === null) return null;
  const prevRow = prevRes.rows[0];
  let prevReading = toNumberOrNull(prevRow?.reading_value);
  let prevDate = normalizeSnapshotDate(toDateOnlyString(prevRow?.reading_date));

  if (prevReading === null) {
    const initial = await fetchInitialElectricityReading(unitNumber, input.unit?.id ?? null);
    if (initial) {
      prevReading = initial.value;
      prevDate = initial.date;
    }
  }

  if (prevReading === null) return null;

  const electricityLine = input.lineItems.find((item) => {
    const meta = item.meta && typeof item.meta === "object" ? item.meta : null;
    return meta?.kind === "METER_ELECTRICITY" || /electric/i.test(String(item.description || ""));
  });
  const electricityMeta = electricityLine?.meta && typeof electricityLine.meta === "object" ? electricityLine.meta : null;
  const rate = Number(electricityMeta?.unit_rate ?? electricityLine?.rate ?? 0.41);
  const usage = Number(Math.max(curReading - prevReading, 0).toFixed(2));

  return {
    prevDate: normalizeSnapshotDate(prevDate || "Initial"),
    prevReading,
    currDate: normalizeSnapshotDate(toDateOnlyString(curRow?.reading_date)),
    currReading: curReading,
    usage,
    rate,
    amount: Number((usage * rate).toFixed(2)),
    unitLabel: "kWh",
  } satisfies MeterSnapshot;
}

async function findLegacyInvoiceRow(id: string): Promise<InvoiceHeaderRow | null> {
  const data = await datasetsRepo.getDataset<unknown[]>("billing_invoices", []);
  if (!Array.isArray(data)) return null;
  const item = data.find(
    (inv) => typeof inv === "object" && inv !== null && (inv as Record<string, unknown>).id === id,
  );
  if (!item) return null;
  const row = item as Record<string, unknown>;
  const rentAmount = Number(row.rentAmount ?? 0);
  const electricityAmount = Number(row.electricityAmount ?? 0);
  const cleaningAmount = Number(row.cleaningAmount ?? 0);
  const lineItems: InvoiceLineItem[] = [];
  if (rentAmount > 0) {
    lineItems.push({ id: "rent-1", description: "Monthly Rent", qty: 1, rate: rentAmount, amount: rentAmount, meta: { kind: "RENT" } as Record<string, unknown> });
  }
  if (electricityAmount > 0) {
    lineItems.push({ id: "elec-1", description: "Electricity", qty: 1, rate: electricityAmount, amount: electricityAmount, meta: { kind: "METER_ELECTRICITY" } as Record<string, unknown> });
  }
  if (cleaningAmount > 0) {
    lineItems.push({ id: "clean-1", description: "Cleaning Service", qty: 1, rate: cleaningAmount, amount: cleaningAmount });
  }
  return {
    id: String(row.id),
    tenant_id: String(row.tenantId ?? row.tenant_id ?? "") || null,
    unit_id: String(row.unitId ?? row.unit_id ?? "") || null,
    invoice_number: null,
    invoice_date: String(row.invoiceDate ?? row.invoice_date ?? "") || null,
    due_date: null,
    status: String(row.status ?? "unpaid"),
    currency: "USD",
    notes: null,
    meta: null,
    period: null,
    line_items: lineItems as unknown as InvoiceLineItem[],
    meter_snapshot: null,
  };
}

async function loadInvoiceLines(invoiceId: string, storedLineItems: unknown) {
  const mappedStored = mapStoredLineItems(storedLineItems);
  if (mappedStored.length) {
    return mappedStored;
  }
  const lineRes = await query(
    `SELECT id, invoice_id, line_index, description, quantity, unit_price_cents, total_cents, meta, created_at
     FROM public.invoice_lines
     WHERE invoice_id = $1
     ORDER BY line_index ASC, created_at ASC`,
    [invoiceId],
  );
  return mapInvoiceLineRows(lineRes.rows as InvoiceLineRow[]);
}

async function loadTenantRecord(tenantId: string | null, unit: UnitLookupRow | null): Promise<TenantRecord> {
  if (tenantId) {
    try {
      const tenantRes = await query(
        `SELECT id, name, building, property_id, unit, monthly_rent, due_day, reference
         FROM public.tenants
         WHERE id = $1
         LIMIT 1`,
        [tenantId],
      );
      const tenantRow = tenantRes.rows[0] as Partial<TenantRecord> | undefined;
      if (tenantRow) {
        return {
          id: String(tenantRow.id || tenantId),
          name: String(tenantRow.name || "Tenant"),
          building: tenantRow.building ?? undefined,
          property_id: tenantRow.property_id ?? undefined,
          unit: tenantRow.unit ?? (unit?.unit_number !== null && unit?.unit_number !== undefined ? String(unit.unit_number) : undefined),
          monthly_rent:
            tenantRow.monthly_rent !== null && tenantRow.monthly_rent !== undefined
              ? Number(tenantRow.monthly_rent)
              : undefined,
          due_day: tenantRow.due_day !== null && tenantRow.due_day !== undefined ? Number(tenantRow.due_day) : undefined,
          reference: tenantRow.reference ?? undefined,
        };
      }
    } catch (err) {
      console.warn("Failed to load tenant for invoice export:", err);
    }
  }

  return {
    id: tenantId || "",
    name: tenantId || "Tenant",
    property_id: unit?.property_id ?? undefined,
    unit: unit?.unit_number !== null && unit?.unit_number !== undefined ? String(unit.unit_number) : undefined,
  };
}

async function buildInvoicePayloadFromRow(invoice: InvoiceHeaderRow, fallbackReference: Date): Promise<InvoicePayload> {
  const invoiceId = String(invoice.id);
  const issueDate = getInvoiceReference(invoice, fallbackReference);
  const unitRes = invoice.unit_id
    ? await query(
        `SELECT id, property_id, unit_number
         FROM public.units
         WHERE id = $1
         LIMIT 1`,
        [invoice.unit_id],
      )
    : { rows: [] };
  const unit = (unitRes.rows[0] as UnitLookupRow | undefined) ?? null;
  const tenant = await loadTenantRecord(invoice.tenant_id, unit);
  const lineItems = await loadInvoiceLines(invoiceId, invoice.line_items);
  const totalAmount = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const savedSnapshot = normalizeMeterSnapshot(
    invoice.meter_snapshot ?? invoice.meta?.meter_snapshot ?? invoice.meta?.meterSnapshot ?? null,
  );
  let meterSnapshot = deriveMeterSnapshotFromLineItems(lineItems, savedSnapshot);
  if (!isMeterSnapshotComplete(meterSnapshot)) {
    try {
      const readingsSnapshot = await fetchMeterSnapshotFromReadings({
        unit,
        invoice,
        lineItems,
        fallbackReference,
      });
      if (readingsSnapshot) {
        meterSnapshot = readingsSnapshot;
      }
    } catch (err) {
      console.warn("Failed to hydrate meter snapshot from readings:", err);
    }
  }
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : dueDateForMonth(issueDate, tenant.due_day);
  const propertyLabel = await resolvePropertyLabel(tenant.property_id, tenant.building);

  return {
    tenant,
    propertyLabel,
    invoiceId,
    line_items: lineItems,
    meter_snapshot: meterSnapshot,
    total_amount: totalAmount,
    invoiceNumber: invoice.invoice_number || invoiceId,
    issueDate,
    dueDate,
  };
}

async function renderInvoicesPdf(invoices: InvoicePayload[], reference: Date, company: CompanyProfile) {
  const fontRegular = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
  const doc = new PDFDocument({ size: "A4", margin: 48, autoFirstPage: false, font: fontRegular });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  // Use embedded fonts (avoid PDFKit built-in Helvetica.afm which can be missing in production)
  doc.registerFont("Inter", fontRegular);
  doc.registerFont("Inter-Bold", fontBold);
  doc.font("Inter");

  const logoBuffer = await resolveLogoBuffer("/branding/Logo.png");
  const paymentBox = paymentBoxContent(company);

  const addInvoicePage = (payload: InvoicePayload, index: number) => {
    doc.addPage({ size: "A4", margin: 48 });

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    let y = doc.page.margins.top;

    const metaWidth = 220;
    const logoWidth = 180;
    const logoX = right - logoWidth;
    if (logoBuffer) {
      doc.image(logoBuffer, logoX, y, { width: logoWidth });
    }

    doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(24).text("Invoice", left, y, {
      width: contentWidth - metaWidth - 24,
    });
    y += 28;
    doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text(payload.invoiceNumber, left, y);
    doc.text(formatTemplateDate(payload.issueDate), left, y + 14);

    const metaTop = doc.page.margins.top + 140;
    doc
      .moveTo(left, metaTop)
      .lineTo(right, metaTop)
      .strokeColor("#0e0e0e")
      .lineWidth(1.2)
      .stroke();

    y = metaTop + 24;

    const billToX = left;
    const fromX = left + contentWidth / 2;
    const sectionY = y;
    doc.fillColor("#b8972a").font("Inter-Bold").fontSize(8).text("FROM", billToX, sectionY, { characterSpacing: 1.2 });
    doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(13).text(company.name, billToX, sectionY + 12);
    doc.fillColor("#6b6b6b").font("Inter").fontSize(10);
    const fromLines = [company.address, company.phone].filter(Boolean);
    fromLines.forEach((line, idx) => {
      doc.text(line || "", billToX, sectionY + 28 + idx * 13);
    });

    doc.fillColor("#b8972a").font("Inter-Bold").fontSize(8).text("BILLED TO", fromX, sectionY, { characterSpacing: 1.2 });
    doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(13).text(payload.tenant.name, fromX, sectionY + 12);
    doc.fillColor("#6b6b6b").font("Inter").fontSize(10);
    const tenantLines = [
      payload.tenant.unit ? `Unit ${payload.tenant.unit}` : "Unit -",
      payload.propertyLabel || company.name,
      monthLabel(payload.issueDate),
    ];
    tenantLines.forEach((line, idx) => {
      doc.text(line, fromX, sectionY + 28 + idx * 13);
    });

    y = sectionY + 82;
    const totals = summarizeLineItems(payload.line_items || []);

    const shouldShowMeterBlock =
      Boolean(payload.meter_snapshot) ||
      (payload.line_items || []).some(
        (item) => item.meta?.kind === "METER_ELECTRICITY" || item.description.toLowerCase().includes("electric"),
      );

    if (shouldShowMeterBlock) {
      const snap = payload.meter_snapshot;
      const meterHeight = 66;
      doc.roundedRect(left, y, contentWidth, meterHeight, 6).fillAndStroke("#faf9f7", "#d0ccc4");
      doc.fillColor("#b8972a").font("Inter-Bold").fontSize(8).text("ELECTRICITY METER SNAPSHOT", left + 16, y + 12, {
        characterSpacing: 1.1,
      });
      const meterCols = 5;
      const meterCellWidth = (contentWidth - 32) / meterCols;
      const meterItems = [
        { label: "Prev. Date", value: snap ? formatTemplateDate(snap.prevDate) || "Initial" : "Initial" },
        { label: "Prev. Reading", value: snap ? `${formatQuantity(snap.prevReading)} ${snap.unitLabel || "kWh"}` : "-" },
        { label: "Curr. Date", value: snap ? formatTemplateDate(snap.currDate) || "-" : "-" },
        { label: "Curr. Reading", value: snap ? `${formatQuantity(snap.currReading)} ${snap.unitLabel || "kWh"}` : "-" },
        { label: "Usage", value: snap ? `${formatQuantity(snap.usage)} ${snap.unitLabel || "kWh"}` : "-" },
      ];
      meterItems.forEach((item, meterIndex) => {
        const x = left + 16 + meterCellWidth * meterIndex;
        doc.fillColor("#6b6b6b").font("Inter").fontSize(7).text(item.label.toUpperCase(), x, y + 28, {
          width: meterCellWidth - 8,
        });
        doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(9).text(item.value, x, y + 40, {
          width: meterCellWidth - 8,
        });
      });
      y += meterHeight + 18;
    }

    const tableTop = y;
    const colDesc = left;
    const colQty = left + 260;
    const colRate = left + 350;
    const colAmount = right - 96;
    doc.fillColor("#6b6b6b").font("Inter-Bold").fontSize(8);
    doc.text("DESCRIPTION", colDesc, tableTop);
    doc.text("QTY", colQty, tableTop, { width: 60, align: "right" });
    doc.text("UNIT RATE", colRate, tableTop, { width: 80, align: "right" });
    doc.text("AMOUNT", colAmount, tableTop, { width: 100, align: "right" });

    y = tableTop + 16;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
    y += 8;

    doc.font("Inter").fontSize(10).fillColor("#1a1a1a");
    const lineItems = payload.line_items || [];
    lineItems.forEach((item) => {
      const lineDisplay = describeLineItem(item);
      const descWidth = colQty - colDesc - 14;
      const titleHeight = doc.heightOfString(lineDisplay.title, { width: descWidth });
      const subtitleHeight = lineDisplay.subtitle
        ? doc.heightOfString(lineDisplay.subtitle, { width: descWidth })
        : 0;
      const rowHeight = Math.max(titleHeight + subtitleHeight + (lineDisplay.subtitle ? 8 : 0), 20);
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(10).text(lineDisplay.title, colDesc, y, { width: descWidth });
      if (lineDisplay.subtitle) {
        doc.fillColor("#6b6b6b").font("Inter").fontSize(8.5).text(lineDisplay.subtitle, colDesc, y + titleHeight + 2, {
          width: descWidth,
        });
      }
      doc.fillColor("#6b6b6b").font("Inter").fontSize(9);
      doc.text(formatQuantity(item.qty), colQty, y, { width: 60, align: "right" });
      doc.text(toMoney(item.rate), colRate, y, { width: 80, align: "right" });
      doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(9).text(toMoney(item.amount), colAmount, y, {
        width: 100,
        align: "right",
      });
      y += rowHeight + 10;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor("#d0ccc4").lineWidth(0.7).stroke();
    });

    const footerY = doc.page.height - doc.page.margins.bottom - 22;
    const paymentBoxWidth = 264;
    const paymentBoxPadding = 16;
    const paymentInstructionsHeight =
      paymentBox.visible && paymentBox.instructions
        ? doc.font("Inter").fontSize(8).heightOfString(paymentBox.instructions, { width: paymentBoxWidth - paymentBoxPadding * 2 })
        : 0;
    const paymentBoxHeight = paymentBox.visible
      ? 44 + paymentBox.lines.length * 11 + (paymentBox.instructions ? paymentInstructionsHeight + 12 : 0)
      : 0;
    const totalsHeight =
      totals.reduce((height, _row, idx) => height + (idx === totals.length - 1 ? 22 : 18), 0) + 32;
    const summaryHeight = Math.max(paymentBoxHeight, totalsHeight);
    const summaryTop = footerY - summaryHeight - 18;

    if (y > summaryTop - 56) {
      doc.addPage({ size: "A4", margin: 48 });
      y = doc.page.margins.top;
    }

    const totalsX = right - 220;
    const totalsY = footerY - totalsHeight - 18;
    y = totalsY;
    totals.forEach((row, idx) => {
      doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text(row.label, totalsX, y, { width: 100 });
      doc.fillColor("#1a1a1a").font("Inter").fontSize(10).text(toMoney(row.amount), totalsX + 100, y, {
        width: 120,
        align: "right",
      });
      y += idx === totals.length - 1 ? 22 : 18;
    });
    doc.moveTo(totalsX, y - 6).lineTo(right, y - 6).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
    doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(16).text("Total Due", totalsX, y, { width: 100 });
    doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(16).text(toMoney(payload.total_amount), totalsX + 100, y, {
      width: 120,
      align: "right",
    });

    if (paymentBox.visible) {
      const boxX = left;
      const boxY = footerY - paymentBoxHeight - 18;
      doc.roundedRect(boxX, boxY, paymentBoxWidth, paymentBoxHeight, 6).fillAndStroke("#faf9f7", "#d0ccc4");
      doc.fillColor("#b8972a").font("Inter-Bold").fontSize(8).text("PAYMENT DETAILS", boxX + 16, boxY + 12, {
        characterSpacing: 1.1,
      });
      let paymentY = boxY + 28;
      paymentBox.lines.forEach((line) => {
        doc.fillColor("#1a1a1a").font("Inter").fontSize(9).text(line, boxX + 16, paymentY, {
          width: paymentBoxWidth - paymentBoxPadding * 2,
        });
        paymentY += 11;
      });
      if (paymentBox.instructions) {
        paymentY += 4;
        doc.fillColor("#6b6b6b").font("Inter").fontSize(8).text(paymentBox.instructions, boxX + 16, paymentY, {
          width: paymentBoxWidth - paymentBoxPadding * 2,
        });
      }
    }

    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor("#d0ccc4").lineWidth(0.7).stroke();
    doc.fillColor("#b0b0b0").font("Inter").fontSize(8).text("Thank you for your tenancy at Orfane Tower.", left, footerY + 8);
    doc.text("ORFANE TOWER", right - 120, footerY + 8, { width: 120, align: "right" });
  };

  if (!invoices.length) {
    doc.addPage({ size: "A4", margin: 48 });
    doc.fillColor("#000000").font("Inter-Bold").fontSize(18).text("No charges found", doc.page.margins.left, doc.page.margins.top);
  } else {
    invoices.forEach(addInvoicePage);
  }

  doc.end();

  return await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function resolveLogoBuffer(logoPath: string) {
  const normalized = (logoPath || "").trim();
  const fallback = "/branding/Logo.png";
  const candidates = [normalized, fallback].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (!candidate) continue;
      if (candidate.endsWith(".svg")) {
        // PDFKit doesn't support SVG; skip to fallback PNG.
        continue;
      }
      if (candidate.startsWith("data:")) {
        if (candidate.startsWith("data:image/svg")) continue;
        const base64 = candidate.split(",")[1] || "";
        if (!base64) continue;
        return Buffer.from(base64, "base64");
      }
      if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      const relative = candidate.startsWith("/") ? candidate.slice(1) : candidate;
      const filePath = path.join(process.cwd(), "public", relative);
      return await fs.readFile(filePath);
    } catch {
      continue;
    }
  }

  return null;
}

function buildInvoiceSection(
  tenant: TenantRecord,
  propertyLabel: string,
  lineItems: InvoiceLineItem[],
  meterSnapshot: MeterSnapshot | null,
  totalAmount: number,
  company: CompanyProfile,
  invoiceNumber: string,
  issueDate: Date,
  dueDate: Date,
) {
  if (!lineItems.length) return "";
  const unitLabel = tenant.unit ? `Unit ${tenant.unit}` : "Unit —";
  const fromLines = [company.address, company.phone].filter(Boolean);
  const paymentBox = paymentBoxContent(company);
  const totals = summarizeLineItems(lineItems);
  const totalRows = totals
    .map(
      (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${toMoney(row.amount)}</td>
          </tr>`,
    )
    .join("");

  const lines = lineItems
    .map(
      (item) => {
        const lineDisplay = describeLineItem(item);
        return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(lineDisplay.title)}</div>
            ${lineDisplay.subtitle ? `<div class="item-sub">${escapeHtml(lineDisplay.subtitle)}</div>` : ""}
          </td>
          <td class="right muted">${formatQuantity(item.qty)}</td>
          <td class="right muted">${toMoney(item.rate)}</td>
          <td class="right">${toMoney(item.amount)}</td>
        </tr>`;
      },
    )
    .join("");

  const logoPath = "/branding/Logo.png";
  const logo = `<img class="logo" src="${logoPath}" alt="${company.name} logo" />`;
  const shouldShowMeterBlock =
    Boolean(meterSnapshot) ||
    lineItems.some((item) => item.meta?.kind === "METER_ELECTRICITY" || item.description.toLowerCase().includes("electric"));
  const meterBlock = shouldShowMeterBlock
    ? `
      <div class="meter-block">
        <div class="meter-block-title">Electricity Meter Snapshot</div>
        <div class="meter-row">
          <div class="meter-item">
            <div class="meter-item-label">Prev. Date</div>
            <div class="meter-item-val">${escapeHtml(meterSnapshot ? formatTemplateDate(meterSnapshot.prevDate) || "Initial" : "Initial")}</div>
          </div>
          <div class="meter-item">
            <div class="meter-item-label">Prev. Reading</div>
            <div class="meter-item-val">${meterSnapshot ? `${formatQuantity(meterSnapshot.prevReading)} ${escapeHtml(meterSnapshot.unitLabel || "kWh")}` : "-"}</div>
          </div>
          <div class="meter-item">
            <div class="meter-item-label">Curr. Date</div>
            <div class="meter-item-val">${escapeHtml(meterSnapshot ? formatTemplateDate(meterSnapshot.currDate) || "-" : "-")}</div>
          </div>
          <div class="meter-item">
            <div class="meter-item-label">Curr. Reading</div>
            <div class="meter-item-val">${meterSnapshot ? `${formatQuantity(meterSnapshot.currReading)} ${escapeHtml(meterSnapshot.unitLabel || "kWh")}` : "-"}</div>
          </div>
          <div class="meter-item">
            <div class="meter-item-label">Usage</div>
            <div class="meter-item-val">${meterSnapshot ? `${formatQuantity(meterSnapshot.usage)} ${escapeHtml(meterSnapshot.unitLabel || "kWh")}` : "-"}</div>
          </div>
        </div>
      </div>
    `
    : "";
  const paymentBlock = paymentBox.visible
    ? `
      <div class="payment-box">
        <div class="payment-box-title">Payment Details</div>
        <div class="payment-box-body">
          ${paymentBox.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          ${paymentBox.instructions ? `<div class="payment-box-note">${escapeHtml(paymentBox.instructions)}</div>` : ""}
        </div>
      </div>
    `
    : "";

  return `
    <section class="invoice page">
      <div class="inv-header">
        <div class="inv-meta">
          <div class="inv-label">Invoice</div>
          <div class="inv-number">${escapeHtml(invoiceNumber)}</div>
          <div class="inv-date">${escapeHtml(formatTemplateDate(issueDate))}</div>
        </div>
        <div class="logo-block">
          ${logo}
        </div>
      </div>
      <div class="parties">
        <div>
          <div class="party-label">From</div>
          <div class="party-name">${escapeHtml(company.name)}</div>
          <div class="party-detail">${fromLines.map((line) => escapeHtml(line)).join("<br>")}</div>
        </div>
        <div>
          <div class="party-label">Billed To</div>
          <div class="party-name">${escapeHtml(tenant.name)}</div>
          <div class="party-detail">
            ${escapeHtml(unitLabel)}<br>
            ${escapeHtml(propertyLabel)}<br>
            ${escapeHtml(extractBillingPeriodSubtitle(issueDate))}
          </div>
        </div>
      </div>

      ${meterBlock}

      <table class="items-table">
        <thead>
          <tr>
            <th style="width:46%">Description</th>
            <th class="right" style="width:14%">Qty</th>
            <th class="right" style="width:18%">Unit Rate</th>
            <th class="right" style="width:22%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines}
        </tbody>
      </table>

      <div class="summary-row${paymentBox.visible ? "" : " summary-row-only-totals"}">
        ${paymentBlock}
        <div class="totals-block">
          <table class="totals-table">
            ${totalRows}
            <tr class="total-final">
              <td>Total Due</td>
              <td>${toMoney(totalAmount)}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="inv-footer">
        <div class="footer-note">Thank you for your tenancy at Orfane Tower.</div>
        <div class="footer-brand">ORFANE TOWER</div>
      </div>
    </section>
  `;
}

export async function GET(req: NextRequest) {
  try {
    let company = FALLBACK_COMPANY;
    try {
      const organization = await getOrganizationSnapshot();
      company = buildCompanyProfile(organization);
    } catch (err) {
      console.warn("Failed to load organization settings for invoice export:", err);
    }
    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get("tenantId") || searchParams.get("tenant") || "";
    const requestedInvoiceId = searchParams.get("invoiceId") || "";
    const mode = searchParams.get("mode") || "download";
    const wantsPdf = mode === "download" || mode === "pdf";
    const requestedMonth = searchParams.get("month") || "";
    const requestedYear = searchParams.get("year") || "";
    let reference = new Date();
    if (requestedMonth || requestedYear) {
      const monthIndex = toMonthIndex(requestedMonth || MONTHS[reference.getUTCMonth()]);
      const year = Number(requestedYear || reference.getUTCFullYear());
      if (monthIndex !== null && Number.isFinite(year)) {
        reference = new Date(Date.UTC(year, monthIndex, 1));
      }
    }

    const { start, end } = monthRange(reference);
    const normalizedTenantId = normalizeId(requestedTenantId);
    let invoicePayloads: InvoicePayload[] = [];

    if (requestedInvoiceId) {
      const singleRes = await query(
        `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta, period, line_items, meter_snapshot
         FROM public.invoices
         WHERE id = $1
         LIMIT 1`,
        [requestedInvoiceId],
      );
      let invoiceRow = singleRes.rows[0] as InvoiceHeaderRow | undefined;
      if (!invoiceRow) {
        // Fallback: look in the legacy billing_invoices dataset
        const legacyRow = await findLegacyInvoiceRow(requestedInvoiceId);
        invoiceRow = legacyRow ?? undefined;
      }
      if (!invoiceRow) {
        return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
      }
      invoicePayloads = [await buildInvoicePayloadFromRow(invoiceRow, reference)];
      reference = invoicePayloads[0]?.issueDate || reference;
    } else {
      let tenants: TenantRecord[] = [];
      try {
        const rawTenants = await tenantsRepo.listTenants();
        tenants = rawTenants.map((tenant) => ({
          ...tenant,
          property_id: opt(tenant.property_id),
          building: opt(tenant.building),
          unit: opt(tenant.unit),
          monthly_rent: opt(tenant.monthly_rent),
          due_day: opt(tenant.due_day),
          reference: opt(tenant.reference),
        }));
      } catch (err) {
        console.warn("Failed to load tenants for invoice export:", err);
      }
      const tenantIndex = new Map<string, TenantRecord>();
      tenants.forEach((tenant) => tenantIndex.set(String(tenant.id), tenant));
      const res = await query(
        `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta, period, line_items, meter_snapshot
         FROM public.invoices
         WHERE invoice_date >= $1 AND invoice_date <= $2
         ORDER BY invoice_date ASC, id ASC`,
        [start, end],
      );
      let invoiceRows = res.rows as InvoiceHeaderRow[];
      if (requestedTenantId) {
        invoiceRows = invoiceRows.filter((invoice) => {
          const rawTenantId = String(invoice.tenant_id || "");
          if (!rawTenantId) return false;
          if (rawTenantId === requestedTenantId) return true;
          return normalizedTenantId ? normalizeId(rawTenantId) === normalizedTenantId : false;
        });
      }

      invoicePayloads = await Promise.all(
        invoiceRows.map(async (invoice) => {
          const built = await buildInvoicePayloadFromRow(invoice, reference);
          const tenant = tenantIndex.get(String(invoice.tenant_id));
          if (!tenant) return built;
          const nextTenant = {
            id: tenant.id,
            name: tenant.name,
            property_id: tenant.property_id ?? built.tenant.property_id,
            building: tenant.building ?? built.tenant.building,
            unit: tenant.unit ?? built.tenant.unit,
            reference: tenant.reference ?? undefined,
            monthly_rent: tenant.monthly_rent ?? undefined,
            due_day: tenant.due_day ?? undefined,
          } satisfies TenantRecord;
          return {
            ...built,
            tenant: nextTenant,
            propertyLabel: await resolvePropertyLabel(nextTenant.property_id, nextTenant.building),
            dueDate: invoice.due_date ? new Date(invoice.due_date) : dueDateForMonth(built.issueDate, tenant.due_day),
          } satisfies InvoicePayload;
        }),
      );
    }

    if (wantsPdf) {
      const pdf = await renderInvoicesPdf(invoicePayloads, reference, company);
      const filenameReference = invoicePayloads[0]?.issueDate || reference;
      const periodLabel = toISO(filenameReference).slice(0, 7);
      const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      let filename = `Invoices-${periodLabel}.pdf`;
      if (invoicePayloads.length === 1) {
        const single = invoicePayloads[0];
        const invoiceNumber = sanitize(String(single.invoiceNumber || single.invoiceId || "invoice"));
        const tenantLabel = single.tenant.unit ? `Unit-${single.tenant.unit}` : single.tenant.name || "Tenant";
        const tenantSafe = sanitize(String(tenantLabel));
        filename = `Invoice-${invoiceNumber}-${tenantSafe}-${periodLabel}.pdf`;
      }
      const disposition = mode === "download" ? "attachment" : "inline";
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${filename}"`,
        },
      });
    }

    const sections = invoicePayloads
      .map((payload) =>
        buildInvoiceSection(
          payload.tenant,
          payload.propertyLabel,
          payload.line_items,
          payload.meter_snapshot,
          payload.total_amount,
          company,
          payload.invoiceNumber,
          payload.issueDate,
          payload.dueDate,
        ),
      )
      .filter(Boolean)
      .join("");

    const body =
      sections ||
      `<section class="empty">No charges found for ${monthLabel(reference)}${normalizedTenantId ? " for this tenant" : ""}.</section>`;

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoice — Orfane Tower</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :root {
        --gold: #b8972a;
        --black: #0e0e0e;
        --ink: #1a1a1a;
        --muted: #6b6b6b;
        --rule: #d0ccc4;
        --bg: #faf9f7;
      }
      body { font-family: 'DM Sans', "Helvetica Neue", Arial, sans-serif; background: #e8e4de; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; min-height: 100vh; }
      .invoice { page-break-after: always; }
      .invoice:last-child { page-break-after: auto; }
      .page { width: 794px; min-height: 1123px; background: #fff; margin: 0 auto 32px; padding: 32px 72px 56px; position: relative; box-shadow: 0 8px 48px rgba(0,0,0,0.18); }
      .inv-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 32px; border-bottom: 1.5px solid var(--black); margin-bottom: 32px; }
      .logo-block { margin-top: -8px; }
      .logo-block img { height: 200px; width: auto; display: block; }
      .inv-label { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 600; color: var(--ink); letter-spacing: 0.04em; line-height: 1; }
      .inv-number { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); margin-top: 6px; letter-spacing: 0.06em; }
      .inv-date { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); margin-top: 3px; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 36px; }
      .party-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 8px; }
      .party-name { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
      .party-detail { font-size: 12px; color: var(--muted); line-height: 1.7; }
      .meter-block { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 18px 22px; margin-bottom: 28px; }
      .meter-block-title { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 14px; }
      .meter-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
      .meter-item-label { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
      .meter-item-val { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; color: var(--ink); }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
      .items-table thead tr { border-bottom: 1.5px solid var(--black); }
      .items-table thead th { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); padding: 0 0 10px 0; text-align: left; }
      .items-table thead th.right { text-align: right; }
      .items-table tbody tr { border-bottom: 1px solid var(--rule); }
      .items-table tbody td { padding: 14px 0; font-size: 13px; color: var(--ink); vertical-align: top; }
      .items-table tbody td.right { text-align: right; font-family: 'DM Mono', monospace; }
      .items-table tbody td.muted { color: var(--muted); }
      .item-name { font-weight: 500; }
      .item-sub { font-size: 11px; color: var(--muted); margin-top: 3px; font-family: 'DM Mono', monospace; }
      .summary-row { position: absolute; left: 72px; right: 72px; bottom: 78px; display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; }
      .summary-row-only-totals { justify-content: flex-end; }
      .payment-box { width: 280px; background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 16px 18px; flex: 0 0 280px; }
      .payment-box-title { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
      .payment-box-body { font-size: 11px; color: var(--ink); line-height: 1.6; }
      .payment-box-note { margin-top: 8px; color: var(--muted); font-size: 10px; }
      .totals-block { display: flex; justify-content: flex-end; margin-top: 0; margin-left: auto; }
      .totals-table { width: 280px; }
      .totals-table tr td { padding: 7px 0; font-size: 13px; color: var(--muted); }
      .totals-table tr td:last-child { text-align: right; font-family: 'DM Mono', monospace; color: var(--ink); }
      .totals-table tr.total-final { border-top: 1.5px solid var(--black); }
      .totals-table tr.total-final td { padding-top: 12px; font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 600; color: var(--ink); }
      .inv-footer { position: absolute; bottom: 40px; left: 72px; right: 72px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--rule); padding-top: 14px; }
      .footer-note { font-size: 10px; color: #bbb; }
      .footer-brand { font-family: 'DM Mono', monospace; font-size: 10px; color: #ccc; letter-spacing: 0.06em; }
      .empty { margin: 48px auto; padding: 32px; max-width: 720px; border-radius: 16px; background: #fff; text-align: center; color: var(--ink); }
      @media print {
        body { background: white; padding: 0; }
        .page { box-shadow: none; width: 100%; min-height: auto; padding: 48px 56px; }
        @page { margin: 0; size: A4; }
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;

    const filename = normalizedTenantId
      ? `tenant-invoice-${normalizedTenantId}-${toISO(reference).slice(0, 7)}.html`
      : `tenant-invoices-${toISO(reference).slice(0, 7)}.html`;
    const disposition = "inline";
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Failed to generate invoices:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate invoices",
        detail: process.env.NODE_ENV !== "production" ? (err instanceof Error ? err.message : String(err)) : undefined,
      },
      { status: 500 },
    );
  }
}
