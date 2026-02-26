import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { datasetsRepo, tenantsRepo } from "@/lib/repos";
import {
  ChargeEntry,
  createStatement,
  normalizeId,
  type TenantRecord,
  type StatementRow,
} from "@/lib/reports/tenantStatement";
import { buildCompanyProfile, getOrganizationSnapshot, type CompanyProfile } from "@/lib/settings/organization";

export const runtime = "nodejs";

type ChargeRow = {
  tenant_id: string;
  date: string;
  amount: string | number;
  description?: string;
  category?: string;
  meter_reading_id?: string;
};

type MeterReadingDetail = {
  id: string;
  unit: string;
  meter_type: string;
  reading_date: string;
  reading_value: number;
  prev_value: number;
  usage: number;
  amount: number;
  prev_date?: string | null;
};

type MeterMeta = {
  kind?: "utility";
  meterType: "water" | "electricity";
  prevDate?: string | Date | null;
  currentDate?: string | Date | null;
  prevValue?: number | string;
  currentValue?: number | string;
  usage?: number | string;
  rate?: number | string;
  unitLabel?: string;
};

const METER_RATE = 0.41;

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

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
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

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthShortLabel(reference: Date) {
  return reference.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toMonthIndex(value: string) {
  const idx = MONTHS.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return idx >= 0 ? idx : null;
}

function dueDateForMonth(reference: Date, dueDayRaw: string | number | undefined) {
  const dueDay = Math.max(1, Number(dueDayRaw || 1));
  const dim = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), Math.min(dueDay, dim)));
}

async function fetchMeterReadingDetails(ids: string[]) {
  if (!ids.length) return new Map<string, MeterReadingDetail>();
  let rows: any[] = [];
  try {
    const res = await query(
      `WITH target AS (
         SELECT id, unit, meter_type
         FROM meter_readings
         WHERE id = ANY($1)
       ),
       ranked AS (
         SELECT r.*,
                LAG(r.reading_date) OVER (PARTITION BY r.unit, r.meter_type ORDER BY r.reading_date, r.created_at) AS prev_date
         FROM meter_readings r
         JOIN target t ON t.unit = r.unit AND t.meter_type = r.meter_type
       )
       SELECT id, unit, meter_type, reading_date, reading_value, prev_value, usage, amount, prev_date
       FROM ranked
       WHERE id = ANY($1)`,
      [ids],
    );
    rows = res.rows;
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "meter_readings" does not exist')) {
      return new Map<string, MeterReadingDetail>();
    }
    throw err;
  }

  const map = new Map<string, MeterReadingDetail>();
  rows.forEach((row: any) => {
    map.set(String(row.id), {
      id: String(row.id),
      unit: String(row.unit),
      meter_type: String(row.meter_type),
      reading_date: String(row.reading_date),
      reading_value: Number(row.reading_value || 0),
      prev_value: Number(row.prev_value || 0),
      usage: Number(row.usage || 0),
      amount: Number(row.amount || 0),
      prev_date: row.prev_date ? String(row.prev_date) : null,
    });
  });
  return map;
}

function buildChargeIndex(rows: ChargeRow[], readingMap: Map<string, MeterReadingDetail>) {
  const map = new Map<string, ChargeEntry[]>();
  rows.forEach((row) => {
    const tenantId = normalizeId(row.tenant_id);
    if (!tenantId) return;
    const meterId = row.meter_reading_id ? String(row.meter_reading_id) : "";
    const meter = meterId ? readingMap.get(meterId) : undefined;
    const isUtility = Boolean(meter) || row.category === "utilities";
    const meterType: MeterMeta["meterType"] = meter?.meter_type === "water" ? "water" : "electricity";
    const unitLabel = meterType === "water" ? "m3" : "kWh";
    const entry: ChargeEntry = {
      date: row.date,
      amount: Number(row.amount || 0),
      description: meterType === "water" ? "Water" : meterType === "electricity" ? "Electricity" : row.description || "Charge",
      category: row.category,
      meta: isUtility && meter
        ? {
            kind: "utility",
            meterType,
            prevDate: meter.prev_date,
            prevValue: meter.prev_value,
            currentDate: meter.reading_date,
            currentValue: meter.reading_value,
            usage: meter.usage,
            rate: METER_RATE,
            unitLabel,
          }
        : undefined,
    };
    if (!map.has(tenantId)) {
      map.set(tenantId, []);
    }
    map.get(tenantId)!.push(entry);
  });
  return map;
}

async function nextInvoiceNumber(reference: Date, tenant: TenantRecord) {
  await query(`CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq`);
  await query(
    `CREATE TABLE IF NOT EXISTS public.invoice_numbers (
      seq bigint PRIMARY KEY,
      invoice_number text NOT NULL UNIQUE,
      tenant_id text,
      unit text,
      property_id uuid,
      period text,
      issued_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_invoice_numbers_tenant_period
     ON public.invoice_numbers (tenant_id, period)`,
  );
  const year = reference.getUTCFullYear();
  const period = toISO(reference).slice(0, 7);
  const seqRes = await query(`SELECT nextval('public.invoice_number_seq') AS seq`);
  const seqValue = Number(seqRes.rows[0]?.seq || 0);
  const padded = String(seqValue).padStart(6, "0");
  const invoiceNumber = `INV-${year}-${padded}`;
  await query(
    `INSERT INTO public.invoice_numbers (seq, invoice_number, tenant_id, unit, property_id, period)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      seqValue,
      invoiceNumber,
      tenant.id,
      tenant.unit ? String(tenant.unit) : null,
      tenant.property_id || null,
      period,
    ],
  );
  return invoiceNumber;
}

type InvoicePayload = {
  tenant: TenantRecord;
  rows: StatementRow[];
  total: number;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
};

async function renderInvoicesPdf(invoices: InvoicePayload[], reference: Date, company: CompanyProfile) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const logoBuffer = await resolveLogoBuffer("/branding/Logo.png");

  const addInvoicePage = (payload: InvoicePayload, index: number) => {
    if (index > 0) doc.addPage();

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = doc.page.margins.top;

    if (logoBuffer) {
      doc.image(logoBuffer, left, y, { width: 120 });
      y += 56;
    }

    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(20).text("INVOICE", left, y);
    y += 22;
    doc.fillColor("#64748b").font("Helvetica").fontSize(10).text(`Billing period: ${monthLabel(reference)}`, left, y);

    const metaX = right - 220;
    const metaTop = doc.page.margins.top;
    doc.fillColor("#475569").font("Helvetica").fontSize(9).text("Invoice #", metaX, metaTop, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(payload.invoiceNumber, metaX, metaTop + 12, {
      width: 220,
      align: "right",
    });
    doc.fillColor("#475569").font("Helvetica").fontSize(9).text("Issue date", metaX, metaTop + 30, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(formatUkDate(payload.issueDate), metaX, metaTop + 42, {
      width: 220,
      align: "right",
    });
    doc.fillColor("#475569").font("Helvetica").fontSize(9).text("Due date", metaX, metaTop + 60, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(formatUkDate(payload.dueDate), metaX, metaTop + 72, {
      width: 220,
      align: "right",
    });

    y += 36;

    const billToX = left;
    const fromX = doc.page.width / 2 + 12;
    const sectionY = y + 12;
    doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("BILL TO", billToX, sectionY);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(payload.tenant.name, billToX, sectionY + 14);
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10);
    doc.text(payload.tenant.building || payload.tenant.property_id || "—", billToX, sectionY + 30);
    doc.text(payload.tenant.unit ? `Unit ${payload.tenant.unit}` : "Unit —", billToX, sectionY + 44);

    doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("FROM", fromX, sectionY);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(company.name, fromX, sectionY + 14);
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10);
    const fromLines = [company.address, company.phone].filter(Boolean);
    fromLines.forEach((line, idx) => {
      doc.text(line || "", fromX, sectionY + 30 + idx * 14);
    });

    y = sectionY + 80;

    const tableTop = y;
    const colDesc = left;
    const colDetails = left + 240;
    const colAmount = right - 120;
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", colDesc, tableTop);
    doc.text("DETAILS", colDetails, tableTop);
    doc.text("AMOUNT", colAmount, tableTop, { width: 120, align: "right" });

    y = tableTop + 16;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();
    y += 8;

    doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
    const lineItems = buildInvoiceLineItems(payload.rows, reference);
    lineItems.forEach((item) => {
      const detailsText = item.details.length ? item.details.join("\n") : "—";
      const descWidth = colDetails - colDesc - 12;
      const detailsWidth = colAmount - colDetails - 12;
      const descHeight = doc.heightOfString(item.description, { width: descWidth });
      const detailsHeight = doc.heightOfString(detailsText, { width: detailsWidth });
      const rowHeight = Math.max(descHeight, detailsHeight, 18);
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.text(item.description, colDesc, y, { width: descWidth });
      doc.text(detailsText, colDetails, y, { width: detailsWidth });
      doc.text(toMoney(item.amount), colAmount, y, { width: 120, align: "right" });
      y += rowHeight + 6;
    });

    y += 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();
    y += 10;
    doc.font("Helvetica-Bold").text("Total due", colDesc, y, { width: colAmount - colDesc - 12, align: "right" });
    doc.text(toMoney(payload.total), colAmount, y, { width: 120, align: "right" });
  };

  if (!invoices.length) {
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(18).text("No charges found", doc.page.margins.left, doc.page.margins.top);
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

type InvoiceLineItem = {
  description: string;
  details: string[];
  amount: number;
};

function buildInvoiceLineItems(rows: StatementRow[], reference: Date): InvoiceLineItem[] {
  return rows
    .filter((row) => row.entryType === "charge" && row.charge > 0)
    .map((row) => {
      const meta: MeterMeta | undefined = row.meta as MeterMeta | undefined;
      if (meta?.kind === "utility") {
        const label = meta.meterType === "water" ? "Water" : "Electricity";
        const details: string[] = [];
        const prevDateLabel =
          meta.prevDate && (typeof meta.prevDate === "string" || meta.prevDate instanceof Date)
            ? ` (${formatUkDate(meta.prevDate)})`
            : "";
        if (meta.prevValue !== undefined) {
          details.push(`Previous Reading${prevDateLabel} ${formatQuantity(Number(meta.prevValue))} units`);
        }
        if (meta.currentDate && meta.currentValue !== undefined) {
          details.push(
            `Current Reading (${formatUkDate(meta.currentDate)}) ${formatQuantity(Number(meta.currentValue))} units`,
          );
        }
        const unitLabel = meta.unitLabel || "kWh";
        const rateLabel = toMoney(Number(meta.rate ?? METER_RATE));
        details.push(`Usage ${formatQuantity(Number(meta.usage || 0))} ${unitLabel} @ ${rateLabel}`);
        return {
          description: label,
          details,
          amount: row.charge,
        };
      }

      const rentDescription = row.description?.toLowerCase().startsWith("rent for")
        ? `Monthly Rent (${monthShortLabel(reference)})`
        : row.description;
      return {
        description: rentDescription || "Charge",
        details: [],
        amount: row.charge,
      };
    });
}

function buildInvoiceSection(
  tenant: TenantRecord,
  rows: StatementRow[],
  total: number,
  reference: Date,
  company: CompanyProfile,
  invoiceNumber: string,
) {
  const lineItems = buildInvoiceLineItems(rows, reference);
  if (!lineItems.length) return "";
  const propertyLabel = tenant.building || tenant.property_id || "—";
  const unitLabel = tenant.unit ? `Unit ${tenant.unit}` : "Unit —";
  const dueDate = dueDateForMonth(reference, tenant.due_day);
  const fromLines = [company.address, company.phone].filter(Boolean);

  const lines = lineItems
    .map((item) => {
      const details = item.details.length
        ? item.details.map((line) => `<div>${line}</div>`).join("")
        : "<div>—</div>";
      return `
        <tr>
          <td>${item.description}</td>
          <td>${details}</td>
          <td class="amount">${toMoney(item.amount)}</td>
        </tr>`;
    })
    .join("");

  const logoPath = "/branding/Logo.png";
  const logo = `<img class="logo" src="${logoPath}" alt="${company.name} logo" />`;

  return `
    <section class="invoice">
      <div class="invoice-top">
        <div>
          ${logo}
          <h1>Invoice</h1>
          <p class="muted">Billing period: ${monthLabel(reference)}</p>
        </div>
        <div class="invoice-meta">
          <div><span>Invoice #</span>${invoiceNumber}</div>
          <div><span>Issue date</span>${formatUkDate(reference)}</div>
          <div><span>Due date</span>${formatUkDate(dueDate)}</div>
        </div>
      </div>
      <div class="invoice-grid">
        <div>
          <h2>Bill To</h2>
          <p class="name">${tenant.name}</p>
          <p>${propertyLabel}</p>
          <p>${unitLabel}</p>
        </div>
        <div>
          <h2>From</h2>
          <p class="name">${company.name}</p>
          ${fromLines.map((line) => `<p>${line}</p>`).join("")}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Details</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="total-label">Total due</td>
            <td class="amount total">${toMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const organization = await getOrganizationSnapshot();
    const company = buildCompanyProfile(organization);
    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get("tenantId") || searchParams.get("tenant") || "";
    const mode = searchParams.get("mode") || "download";
    const isView = mode === "view";
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
    const tenants = await tenantsRepo.listTenants();
    const normalizedTenantId = normalizeId(requestedTenantId);
    const scopedTenants = normalizedTenantId
      ? tenants.filter((tenant) => {
          const candidates = [tenant.id, tenant.reference, tenant.unit].filter(Boolean).map(String);
          return candidates.some((candidate) => normalizeId(candidate) === normalizedTenantId);
        })
      : tenants;
    const charges = await datasetsRepo.getDataset<ChargeRow[]>("tenant_charges", []);
    const meterIds = charges.map((row) => row.meter_reading_id).filter(Boolean) as string[];
    const readingMap = await fetchMeterReadingDetails(meterIds);
    const chargeIndex = buildChargeIndex(charges, readingMap);

    const invoicePayloads = (
      await Promise.all(
        scopedTenants.map(async (tenant) => {
          const tenantId = normalizeId(tenant.id);
          const statementTenant: TenantRecord = {
            id: tenant.id,
            name: tenant.name,
            property_id: tenant.property_id ?? undefined,
            building: tenant.building ?? undefined,
            unit: tenant.unit ?? undefined,
            reference: tenant.reference ?? undefined,
            monthly_rent: tenant.monthly_rent ?? undefined,
            due_day: tenant.due_day ?? undefined,
          };
          const additionalCharges = chargeIndex.get(tenantId) || [];
          const { rows, totals } = createStatement({
            tenant: statementTenant,
            start,
            end,
            payments: [],
            additionalCharges,
          });
          if (!totals.charges) return null;
          const invoiceNumber = await nextInvoiceNumber(reference, statementTenant);
          return {
            tenant: statementTenant,
            rows,
            total: totals.charges,
            invoiceNumber,
            issueDate: reference,
            dueDate: dueDateForMonth(reference, statementTenant.due_day),
          } satisfies InvoicePayload;
        }),
      )
    ).filter(Boolean) as InvoicePayload[];

    if (wantsPdf) {
      const pdf = await renderInvoicesPdf(invoicePayloads, reference, company);
      const filename = normalizedTenantId
        ? `tenant-invoice-${normalizedTenantId}-${toISO(reference).slice(0, 7)}.pdf`
        : `tenant-invoices-${toISO(reference).slice(0, 7)}.pdf`;
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
        buildInvoiceSection(payload.tenant, payload.rows, payload.total, reference, company, payload.invoiceNumber),
      )
      .filter(Boolean)
      .join("");

    const body =
      sections ||
      `<section class="empty">No charges found for ${monthLabel(reference)}${normalizedTenantId ? " for this tenant" : ""}.</section>`;

    const themeOverride = isView
      ? `
      body { background: #0b1220; color: #e2e8f0; }
      .invoice { background: #0f172a; box-shadow: 0 16px 32px rgba(2, 6, 23, 0.6); }
      h2, .muted, .invoice-meta span, th, .note { color: #94a3b8; }
      .invoice-meta { color: #cbd5f5; }
      th, td { border-bottom: 1px solid #1f2937; }
      .empty { background: #0f172a; color: #94a3b8; }
      `
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Monthly Invoices</title>
    <style>
      body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; background: #f2f4f8; color: #0f172a; }
      .invoice { background: #fff; margin: 32px auto; padding: 48px; max-width: 860px; border-radius: 16px; box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08); }
      .invoice:last-child { page-break-after: auto; }
      .invoice { page-break-after: always; }
      .invoice-top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
      .logo { height: 52px; width: auto; display: block; margin-bottom: 12px; }
      h1 { margin: 8px 0 4px; font-size: 28px; letter-spacing: 0.05em; text-transform: uppercase; }
      h2 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; }
      .tag { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #9f1239; font-weight: 700; }
      .muted { color: #64748b; font-size: 12px; margin: 0; }
      .invoice-meta { text-align: right; font-size: 12px; color: #475569; }
      .invoice-meta span { display: block; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
      .invoice-meta div { margin-bottom: 6px; }
      .invoice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 32px 0; }
      .name { font-weight: 700; font-size: 16px; margin: 0 0 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th { text-align: left; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 12px 0; }
      td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
      .amount { text-align: right; }
      tfoot td { border-bottom: none; }
      .total-label { text-align: right; font-weight: 600; }
      .total { font-size: 18px; font-weight: 700; }
      .note { margin-top: 16px; font-size: 12px; color: #64748b; }
      .empty { margin: 48px auto; padding: 32px; max-width: 720px; border-radius: 16px; background: #fff; text-align: center; color: #64748b; }
      ${themeOverride}
      @media print {
        body { background: #fff; }
        .invoice { box-shadow: none; margin: 0; border-radius: 0; }
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
    console.error("Failed to generate invoices", err);
    return NextResponse.json({ ok: false, error: "Failed to generate invoices" }, { status: 500 });
  }
}
