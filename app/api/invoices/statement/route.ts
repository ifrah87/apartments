import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const COMPANY_NAME = "Orfane Tower";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents || 0);
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

async function resolveLogoBuffer() {
  const logoPath = path.join(process.cwd(), "public", "branding", "Logo.png");
  try {
    return await fs.readFile(logoPath);
  } catch {
    return null;
  }
}

async function renderStatementPdf(
  tenantName: string,
  rows: {
    unit: string;
    period: string;
    invoiceNumber: string;
    invoiceDate: string;
    total: number;
    paid: number;
    outstanding: number;
    status: string;
  }[],
) {
  const fontRegular = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
  const doc = new PDFDocument({ size: "A4", margin: 48, autoFirstPage: true, font: fontRegular });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  doc.registerFont("Inter", fontRegular);
  doc.registerFont("Inter-Bold", fontBold);
  doc.font("Inter");

  const logoBuffer = await resolveLogoBuffer();
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;
  let y = doc.page.margins.top;

  // Logo
  const logoWidth = 160;
  const logoX = right - logoWidth;
  if (logoBuffer) {
    doc.image(logoBuffer, logoX, y, { width: logoWidth });
  }

  // Title block
  doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(22).text("Statement of Account", left, y);
  y += 28;
  doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text(`Generated: ${fmtDate(new Date())}`, left, y);

  y = doc.page.margins.top + 130;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
  y += 20;

  // Tenant block
  doc.fillColor("#b8972a").font("Inter-Bold").fontSize(8).text("TENANT", left, y, { characterSpacing: 1.2 });
  doc.fillColor("#6b6b6b").font("Inter-Bold").fontSize(8).text("PROPERTY", left + contentWidth / 2, y, { characterSpacing: 1.2 });
  y += 14;
  doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(14).text(tenantName, left, y);
  doc.fillColor("#1a1a1a").font("Inter").fontSize(11).text(COMPANY_NAME, left + contentWidth / 2, y);
  y += 40;

  // Table header
  const colUnit = left;
  const colPeriod = left + 60;
  const colInvNum = left + 175;
  const colDate = left + 280;
  const colTotal = left + 375;
  const colOutstanding = left + 440;
  const colStatus = right - 52;

  doc.fillColor("#6b6b6b").font("Inter-Bold").fontSize(8);
  doc.text("UNIT", colUnit, y);
  doc.text("PERIOD", colPeriod, y);
  doc.text("INVOICE #", colInvNum, y);
  doc.text("DATE", colDate, y);
  doc.text("TOTAL", colTotal, y, { width: 60, align: "right" });
  doc.text("OUTSTANDING", colOutstanding, y, { width: 60, align: "right" });
  doc.text("STATUS", colStatus, y, { width: 52, align: "right" });

  y += 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
  y += 10;

  let totalCharged = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage({ size: "A4", margin: 48 });
      y = doc.page.margins.top;
    }

    const statusColor = row.status === "Paid" ? "#16a34a" : row.status === "Partially Paid" ? "#d97706" : "#dc2626";

    doc.fillColor("#1a1a1a").font("Inter").fontSize(9);
    doc.text(row.unit, colUnit, y, { width: 55 });
    doc.text(row.period, colPeriod, y, { width: 110 });
    doc.text(row.invoiceNumber, colInvNum, y, { width: 100 });
    doc.text(fmtDate(row.invoiceDate), colDate, y, { width: 90 });
    doc.text(fmt(row.total), colTotal, y, { width: 60, align: "right" });
    doc.text(fmt(row.outstanding), colOutstanding, y, { width: 60, align: "right" });
    doc.fillColor(statusColor).font("Inter-Bold").fontSize(8).text(row.status.toUpperCase(), colStatus, y + 1, { width: 52, align: "right" });

    totalCharged += row.total;
    totalPaid += row.paid;
    totalOutstanding += row.outstanding;

    y += 18;
    doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

  y += 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
  y += 12;

  // Totals
  const totalsX = right - 240;
  doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text("Total Invoiced", totalsX, y, { width: 120 });
  doc.fillColor("#1a1a1a").font("Inter").fontSize(10).text(fmt(totalCharged), totalsX + 120, y, { width: 120, align: "right" });
  y += 18;
  doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text("Total Paid", totalsX, y, { width: 120 });
  doc.fillColor("#16a34a").font("Inter").fontSize(10).text(fmt(totalPaid), totalsX + 120, y, { width: 120, align: "right" });
  y += 18;
  doc.moveTo(totalsX, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1).stroke();
  y += 10;
  doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(13).text("Balance Outstanding", totalsX, y, { width: 140 });
  doc.fillColor(totalOutstanding > 0 ? "#dc2626" : "#16a34a").font("Inter-Bold").fontSize(13)
    .text(fmt(totalOutstanding), totalsX + 120, y, { width: 120, align: "right" });

  // Footer
  const footerY = doc.page.height - doc.page.margins.bottom - 22;
  doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor("#d0ccc4").lineWidth(0.7).stroke();
  doc.fillColor("#b0b0b0").font("Inter").fontSize(8)
    .text("Orfane Tower · Bank: Salaam Bank · Account: Ahmed Awale Sabriyee · Acc No: 32191089", left, footerY + 8);
  doc.text("ORFANE TOWER", right - 120, footerY + 8, { width: 120, align: "right" });

  doc.end();
  return await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantName = searchParams.get("tenantName") || "";
    const mode = searchParams.get("mode") || "pdf";

    if (!tenantName.trim()) {
      return NextResponse.json({ ok: false, error: "tenantName is required" }, { status: 400 });
    }

    // Find all tenant IDs with this name
    const tenantRes = await query(
      `SELECT id, name, unit FROM public.tenants WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
      [tenantName],
    );
    const tenantIds = tenantRes.rows.map((r: any) => String(r.id));

    if (!tenantIds.length) {
      return NextResponse.json({ ok: false, error: "No tenants found with that name" }, { status: 404 });
    }

    // Fetch all invoices for these tenant IDs
    const invoicesRes = await query(
      `SELECT
         i.id,
         i.invoice_number,
         i.invoice_date,
         i.total_amount,
         i.status,
         i.period,
         i.tenant_id,
         u.unit_number
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id = i.unit_id
       WHERE i.tenant_id = ANY($1::text[])
       ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC`,
      [tenantIds],
    );

    const rows = invoicesRes.rows.map((r: any) => {
      const total = Number(r.total_amount || 0);
      const statusRaw = String(r.status || "Unpaid");
      const status = statusRaw === "Paid" || statusRaw === "Partially Paid" || statusRaw === "Unpaid" ? statusRaw : "Unpaid";
      const paid = status === "Paid" ? total : status === "Partially Paid" ? 0 : 0;
      const outstanding = status === "Paid" ? 0 : total;

      // Derive period label
      let period = "";
      if (r.invoice_date) {
        const d = new Date(r.invoice_date);
        if (!isNaN(d.getTime())) {
          period = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
        }
      }
      if (!period && r.period) period = String(r.period);

      return {
        unit: r.unit_number ? `Unit ${r.unit_number}` : "—",
        period,
        invoiceNumber: String(r.invoice_number || r.id).slice(0, 18),
        invoiceDate: r.invoice_date ? String(r.invoice_date) : "",
        total,
        paid,
        outstanding,
        status,
      };
    });

    const pdf = await renderStatementPdf(tenantName, rows);
    const safeName = tenantName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    const filename = `statement_${safeName}.pdf`;
    const disposition = mode === "download" ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
      },
    });
  } catch (err) {
    console.error("❌ /api/invoices/statement failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}
