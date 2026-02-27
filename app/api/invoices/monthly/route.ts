import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { tenantsRepo } from "@/lib/repos";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";
import {
  normalizeId,
  type TenantRecord,
} from "@/lib/reports/tenantStatement";
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
};

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_cents: number;
  total_cents: number;
  meta: Record<string, any> | null;
  created_at?: string;
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

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-US", { month: "long", year: "numeric" });
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

function mapLineItems(rows: InvoiceLineRow[]): InvoiceLineItem[] {
  return rows.map((row) => ({
    id: String(row.id),
    description: String(row.description || ""),
    qty: Number(row.quantity || 0),
    rate: fromCents(row.unit_price_cents),
    amount: fromCents(row.total_cents),
    meta: row.meta ?? undefined,
  }));
}

function extractMeterSnapshot(rows: InvoiceLineRow[]): MeterSnapshot | null {
  for (const row of rows) {
    const meta = row.meta;
    if (!meta || typeof meta !== "object") continue;
    if (String(meta.kind || "").toLowerCase() !== "utility") continue;
    if (String(meta.meterType || "").toLowerCase() !== "electricity") continue;
    const usage = Number(meta.usage ?? row.quantity ?? 0);
    const rate = Number(meta.rate ?? fromCents(row.unit_price_cents));
    const amount = Number(meta.amount ?? usage * rate);
    return {
      prevDate: String(meta.prevDate ?? ""),
      prevReading: Number(meta.prevValue ?? 0),
      currDate: String(meta.currentDate ?? ""),
      currReading: Number(meta.currentValue ?? 0),
      usage,
      rate,
      amount,
      unitLabel: meta.unitLabel ? String(meta.unitLabel) : "kWh",
    };
  }
  return null;
}


type InvoicePayload = {
  tenant: TenantRecord;
  invoiceId: string;
  line_items: InvoiceLineItem[];
  meter_snapshot: MeterSnapshot | null;
  total_amount: number;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
};

async function renderInvoicesPdf(invoices: InvoicePayload[], reference: Date, company: CompanyProfile) {
  const fontRegular = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  // Use embedded fonts (avoid PDFKit built-in Helvetica.afm which can be missing in production)
  doc.registerFont("Inter", fontRegular);
  doc.registerFont("Inter-Bold", fontBold);
  doc.font("Inter");

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

    doc.fillColor("#0f172a").font("Inter-Bold").fontSize(20).text("INVOICE", left, y);
    y += 22;
    doc.fillColor("#64748b").font("Inter").fontSize(10).text(`Billing period: ${monthLabel(reference)}`, left, y);

    const metaX = right - 220;
    const metaTop = doc.page.margins.top;
    doc.fillColor("#475569").font("Inter").fontSize(9).text("Invoice #", metaX, metaTop, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Inter-Bold").fontSize(10).text(payload.invoiceNumber, metaX, metaTop + 12, {
      width: 220,
      align: "right",
    });
    doc.fillColor("#475569").font("Inter").fontSize(9).text("Issue date", metaX, metaTop + 30, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Inter").fontSize(10).text(formatUkDate(payload.issueDate), metaX, metaTop + 42, {
      width: 220,
      align: "right",
    });
    doc.fillColor("#475569").font("Inter").fontSize(9).text("Due date", metaX, metaTop + 60, { width: 220, align: "right" });
    doc.fillColor("#0f172a").font("Inter").fontSize(10).text(formatUkDate(payload.dueDate), metaX, metaTop + 72, {
      width: 220,
      align: "right",
    });

    y += 36;

    const billToX = left;
    const fromX = doc.page.width / 2 + 12;
    const sectionY = y + 12;
    doc.fillColor("#64748b").font("Inter").fontSize(9).text("BILL TO", billToX, sectionY);
    doc.fillColor("#0f172a").font("Inter-Bold").fontSize(12).text(payload.tenant.name, billToX, sectionY + 14);
    doc.fillColor("#0f172a").font("Inter").fontSize(10);
    doc.text(payload.tenant.building || payload.tenant.property_id || "—", billToX, sectionY + 30);
    doc.text(payload.tenant.unit ? `Unit ${payload.tenant.unit}` : "Unit —", billToX, sectionY + 44);

    doc.fillColor("#64748b").font("Inter").fontSize(9).text("FROM", fromX, sectionY);
    doc.fillColor("#0f172a").font("Inter-Bold").fontSize(12).text(company.name, fromX, sectionY + 14);
    doc.fillColor("#0f172a").font("Inter").fontSize(10);
    const fromLines = [company.address, company.phone].filter(Boolean);
    fromLines.forEach((line, idx) => {
      doc.text(line || "", fromX, sectionY + 30 + idx * 14);
    });

    y = sectionY + 80;

    const tableTop = y;
    const colDesc = left;
    const colQty = left + 260;
    const colRate = left + 340;
    const colAmount = right - 100;
    doc.fillColor("#64748b").font("Inter-Bold").fontSize(9);
    doc.text("DESCRIPTION", colDesc, tableTop);
    doc.text("QTY", colQty, tableTop, { width: 60, align: "right" });
    doc.text("RATE", colRate, tableTop, { width: 80, align: "right" });
    doc.text("AMOUNT", colAmount, tableTop, { width: 100, align: "right" });

    y = tableTop + 16;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();
    y += 8;

    doc.font("Inter").fontSize(10).fillColor("#0f172a");
    const lineItems = payload.line_items || [];
    lineItems.forEach((item) => {
      const descWidth = colQty - colDesc - 12;
      const descHeight = doc.heightOfString(item.description, { width: descWidth });
      const rowHeight = Math.max(descHeight, 18);
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.text(item.description, colDesc, y, { width: descWidth });
      doc.text(formatQuantity(item.qty), colQty, y, { width: 60, align: "right" });
      doc.text(toMoney(item.rate), colRate, y, { width: 80, align: "right" });
      doc.text(toMoney(item.amount), colAmount, y, { width: 100, align: "right" });
      y += rowHeight + 6;
    });

    y += 4;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();
    y += 10;
    const totalDue = payload.total_amount;
    doc.font("Inter-Bold").text("Total due", colDesc, y, { width: colAmount - colDesc - 12, align: "right" });
    doc.text(toMoney(totalDue), colAmount, y, { width: 120, align: "right" });

    if (payload.meter_snapshot) {
      const snap = payload.meter_snapshot;
      y += 24;
      doc.font("Inter-Bold").fontSize(10).fillColor("#0f172a").text("Electricity Reading", colDesc, y);
      y += 14;
      doc.font("Inter").fontSize(9).fillColor("#475569");
      if (snap.prevDate) {
        doc.text(`Previous Reading (${formatUkDate(snap.prevDate)}) ${formatQuantity(snap.prevReading)} ${snap.unitLabel || "kWh"}`, colDesc, y);
        y += 12;
      }
      if (snap.currDate) {
        doc.text(`Current Reading (${formatUkDate(snap.currDate)}) ${formatQuantity(snap.currReading)} ${snap.unitLabel || "kWh"}`, colDesc, y);
        y += 12;
      }
      doc.text(
        `Usage ${formatQuantity(snap.usage)} ${snap.unitLabel || "kWh"} @ ${toMoney(snap.rate)} = ${toMoney(snap.amount)}`,
        colDesc,
        y,
      );
    }
  };

  if (!invoices.length) {
    doc.fillColor("#0f172a").font("Inter-Bold").fontSize(18).text("No charges found", doc.page.margins.left, doc.page.margins.top);
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
  lineItems: InvoiceLineItem[],
  meterSnapshot: MeterSnapshot | null,
  totalAmount: number,
  reference: Date,
  company: CompanyProfile,
  invoiceNumber: string,
  issueDate: Date,
  dueDate: Date,
) {
  if (!lineItems.length) return "";
  const propertyLabel = tenant.building || tenant.property_id || "—";
  const unitLabel = tenant.unit ? `Unit ${tenant.unit}` : "Unit —";
  const fromLines = [company.address, company.phone].filter(Boolean);

  const lines = lineItems
    .map(
      (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="qty">${formatQuantity(item.qty)}</td>
          <td class="amount">${toMoney(item.rate)}</td>
          <td class="amount">${toMoney(item.amount)}</td>
        </tr>`,
    )
    .join("");

  const logoPath = "/branding/Logo.png";
  const logo = `<img class="logo" src="${logoPath}" alt="${company.name} logo" />`;
  const prevLine = meterSnapshot?.prevDate
    ? `<p>Previous Reading (${formatUkDate(meterSnapshot.prevDate)}) ${formatQuantity(meterSnapshot.prevReading)} ${
        meterSnapshot.unitLabel || "kWh"
      }</p>`
    : "";
  const currLine = meterSnapshot?.currDate
    ? `<p>Current Reading (${formatUkDate(meterSnapshot.currDate)}) ${formatQuantity(meterSnapshot.currReading)} ${
        meterSnapshot.unitLabel || "kWh"
      }</p>`
    : "";

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
          <div><span>Issue date</span>${formatUkDate(issueDate)}</div>
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
            <th class="qty">Qty</th>
            <th class="amount">Rate</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="total-label">Total due</td>
            <td class="amount total">${toMoney(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      ${
        meterSnapshot
          ? `<div class="meter-block">
          <h3>Electricity Reading</h3>
          ${prevLine}
          ${currLine}
          <p>Usage ${formatQuantity(meterSnapshot.usage)} ${meterSnapshot.unitLabel || "kWh"} @ ${toMoney(
              meterSnapshot.rate,
            )} = ${toMoney(meterSnapshot.amount)}</p>
        </div>`
          : ""
      }
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
    const tenantIndex = new Map<string, TenantRecord>();
    tenants.forEach((tenant) => tenantIndex.set(String(tenant.id), tenant));
    const scopedTenantIds = scopedTenants.map((tenant) => String(tenant.id));

    let invoiceRows: InvoiceHeaderRow[] = [];
    if (!normalizedTenantId || scopedTenantIds.length) {
      if (scopedTenantIds.length) {
        const res = await query(
          `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta
           FROM public.invoices
           WHERE invoice_date >= $1 AND invoice_date <= $2
             AND tenant_id = ANY($3)
           ORDER BY invoice_date ASC, id ASC`,
          [start, end, scopedTenantIds],
        );
        invoiceRows = res.rows as InvoiceHeaderRow[];
      } else {
        const res = await query(
          `SELECT id, tenant_id, unit_id, invoice_number, invoice_date, due_date, status, currency, notes, meta
           FROM public.invoices
           WHERE invoice_date >= $1 AND invoice_date <= $2
           ORDER BY invoice_date ASC, id ASC`,
          [start, end],
        );
        invoiceRows = res.rows as InvoiceHeaderRow[];
      }
    }

    const invoiceIds = invoiceRows.map((row) => String(row.id));
    let lineRows: InvoiceLineRow[] = [];
    if (invoiceIds.length) {
      const lineRes = await query(
        `SELECT id, invoice_id, line_index, description, quantity, unit_price_cents, tax_cents, total_cents, meta, created_at
         FROM public.invoice_lines
         WHERE invoice_id = ANY($1)
         ORDER BY invoice_id ASC, line_index ASC, created_at ASC`,
        [invoiceIds],
      );
      lineRows = lineRes.rows as InvoiceLineRow[];
    }

    const linesByInvoice = new Map<string, InvoiceLineRow[]>();
    lineRows.forEach((row) => {
      const key = String(row.invoice_id);
      if (!linesByInvoice.has(key)) {
        linesByInvoice.set(key, []);
      }
      linesByInvoice.get(key)!.push(row);
    });

    const invoicePayloads = invoiceRows.map((invoice) => {
      const tenant =
        tenantIndex.get(String(invoice.tenant_id)) ||
        ({
          id: String(invoice.tenant_id || ""),
          name: "Tenant",
        } as TenantRecord);
      const lines = linesByInvoice.get(String(invoice.id)) || [];
      const lineItems = mapLineItems(lines);
      const totalCents = lines.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
      const totalAmount = fromCents(totalCents);
      const meterSnapshot = extractMeterSnapshot(lines);
      const issueDate = invoice.invoice_date ? new Date(invoice.invoice_date) : reference;
      const dueDate = invoice.due_date
        ? new Date(invoice.due_date)
        : dueDateForMonth(reference, tenant.due_day);
      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          property_id: tenant.property_id ?? undefined,
          building: tenant.building ?? undefined,
          unit: tenant.unit ?? undefined,
          reference: tenant.reference ?? undefined,
          monthly_rent: tenant.monthly_rent ?? undefined,
          due_day: tenant.due_day ?? undefined,
        },
        invoiceId: String(invoice.id),
        line_items: lineItems,
        meter_snapshot: meterSnapshot,
        total_amount: totalAmount,
        invoiceNumber: invoice.invoice_number || String(invoice.id),
        issueDate,
        dueDate,
      } satisfies InvoicePayload;
    });

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
        buildInvoiceSection(
          payload.tenant,
          payload.line_items,
          payload.meter_snapshot,
          payload.total_amount,
          reference,
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

    const themeOverride = isView
      ? `
      body { background: #0b1220; color: #e2e8f0; }
      .invoice { background: #0f172a; box-shadow: 0 16px 32px rgba(2, 6, 23, 0.6); }
      h2, .muted, .invoice-meta span, th, .note { color: #94a3b8; }
      .invoice-meta { color: #cbd5f5; }
      th, td { border-bottom: 1px solid #1f2937; }
      .meter-block { background: #0b1220; border-color: #1f2937; }
      .meter-block p { color: #94a3b8; }
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
      .qty { text-align: right; width: 70px; }
      .amount { text-align: right; }
      tfoot td { border-bottom: none; }
      .total-label { text-align: right; font-weight: 600; }
      .total { font-size: 18px; font-weight: 700; }
      .meter-block { margin-top: 20px; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
      .meter-block h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; }
      .meter-block p { margin: 4px 0; font-size: 12px; color: #475569; }
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
    console.error("Failed to generate invoices:", err);
    return NextResponse.json({ ok: false, error: "Failed to generate invoices" }, { status: 500 });
  }
}
