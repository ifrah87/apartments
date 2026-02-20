import { NextRequest, NextResponse } from "next/server";
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
};

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

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-US", { month: "long", year: "numeric" });
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

function buildChargeIndex(rows: ChargeRow[]) {
  const map = new Map<string, ChargeEntry[]>();
  rows.forEach((row) => {
    const tenantId = normalizeId(row.tenant_id);
    if (!tenantId) return;
    const entry: ChargeEntry = {
      date: row.date,
      amount: Number(row.amount || 0),
      description: row.description || "Charge",
      category: row.category,
    };
    if (!map.has(tenantId)) {
      map.set(tenantId, []);
    }
    map.get(tenantId)!.push(entry);
  });
  return map;
}

function buildInvoiceSection(
  tenant: TenantRecord,
  rows: StatementRow[],
  total: number,
  reference: Date,
  company: CompanyProfile,
) {
  const lineItems = rows.filter((row) => row.entryType === "charge" && row.charge > 0);
  if (!lineItems.length) return "";
  const propertyLabel = tenant.building || tenant.property_id || "—";
  const unitLabel = tenant.unit ? `Unit ${tenant.unit}` : "Unit —";
  const invoiceNumber = `INV-${toISO(reference).slice(0, 7)}-${normalizeId(tenant.id)}`;
  const dueDate = dueDateForMonth(reference, tenant.due_day);
  const fromLines = [company.address, company.phone, company.email].filter(Boolean);

  const lines = lineItems
    .map(
      (item) => `
        <tr>
          <td>${item.date}</td>
          <td>${item.description}</td>
          <td class="amount">${toMoney(item.charge)}</td>
        </tr>`,
    )
    .join("");

  const logo = company.logoPath
    ? `<img class="logo" src="${company.logoPath}" alt="${company.name} logo" />`
    : "";

  return `
    <section class="invoice">
      <div class="invoice-top">
        <div>
          ${logo}
          <p class="tag">Draft invoice</p>
          <h1>Invoice</h1>
          <p class="muted">Billing period: ${monthLabel(reference)}</p>
        </div>
        <div class="invoice-meta">
          <div><span>Invoice #</span>${invoiceNumber}</div>
          <div><span>Issue date</span>${toISO(reference)}</div>
          <div><span>Due date</span>${toISO(dueDate)}</div>
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
            <th>Date</th>
            <th>Description</th>
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
      <p class="note">Draft only. Send to tenant after review.</p>
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
    const chargeIndex = buildChargeIndex(charges);

    const sections = scopedTenants
      .map((tenant) => {
        const tenantId = normalizeId(tenant.id);
        const statementTenant = {
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
        if (!totals.charges) return "";
        return buildInvoiceSection(statementTenant, rows, totals.charges, reference, company);
      })
      .filter(Boolean)
      .join("");

    const body =
      sections ||
      `<section class="empty">No charges found for ${monthLabel(reference)}${normalizedTenantId ? " for this tenant" : ""}.</section>`;
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
    const disposition = mode === "view" ? "inline" : "attachment";
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
