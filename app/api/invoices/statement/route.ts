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

type LedgerRow = {
  date: string;
  description: string;
  unit: string;
  charge: number;
  payment: number;
  balance: number;
  rowType: "charge" | "payment";
};

async function renderStatementPdf(tenantName: string, rows: LedgerRow[]) {
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
  const colDate = left;
  const colUnit = left + 70;
  const colDesc = left + 115;
  const colCharge = right - 165;
  const colPayment = right - 100;
  const colBalance = right - 35;

  doc.fillColor("#6b6b6b").font("Inter-Bold").fontSize(8);
  doc.text("DATE", colDate, y);
  doc.text("UNIT", colUnit, y);
  doc.text("DESCRIPTION", colDesc, y);
  doc.text("CHARGE", colCharge, y, { width: 60, align: "right" });
  doc.text("PAYMENT", colPayment, y, { width: 60, align: "right" });
  doc.text("BALANCE", colBalance, y, { width: 60, align: "right" });

  y += 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
  y += 10;

  let totalCharged = 0;
  let totalPaid = 0;

  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage({ size: "A4", margin: 48 });
      y = doc.page.margins.top;
    }

    const chargeColor = row.rowType === "charge" ? "#1a1a1a" : "#9ca3af";
    const paymentColor = row.rowType === "payment" ? "#16a34a" : "#9ca3af";
    const balanceColor = row.balance > 0 ? "#dc2626" : row.balance < 0 ? "#16a34a" : "#1a1a1a";

    doc.fillColor("#1a1a1a").font("Inter").fontSize(9);
    doc.text(fmtDate(row.date), colDate, y, { width: 65 });
    doc.text(row.unit, colUnit, y, { width: 40 });
    doc.text(row.description, colDesc, y, { width: colCharge - colDesc - 8 });

    doc.fillColor(chargeColor).font(row.rowType === "charge" ? "Inter-Bold" : "Inter").fontSize(9);
    doc.text(row.charge > 0 ? fmt(row.charge) : "—", colCharge, y, { width: 60, align: "right" });

    doc.fillColor(paymentColor).font(row.rowType === "payment" ? "Inter-Bold" : "Inter").fontSize(9);
    doc.text(row.payment > 0 ? fmt(row.payment) : "—", colPayment, y, { width: 60, align: "right" });

    doc.fillColor(balanceColor).font("Inter-Bold").fontSize(9);
    doc.text(fmt(row.balance), colBalance, y, { width: 60, align: "right" });

    if (row.rowType === "charge") totalCharged += row.charge;
    else totalPaid += row.payment;

    y += 18;
    doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

  y += 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1.2).stroke();
  y += 12;

  // Totals
  const totalsX = right - 270;
  doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text("Total Charged", totalsX, y, { width: 140 });
  doc.fillColor("#1a1a1a").font("Inter").fontSize(10).text(fmt(totalCharged), totalsX + 140, y, { width: 130, align: "right" });
  y += 18;
  doc.fillColor("#6b6b6b").font("Inter").fontSize(10).text("Total Paid", totalsX, y, { width: 140 });
  doc.fillColor("#16a34a").font("Inter").fontSize(10).text(fmt(totalPaid), totalsX + 140, y, { width: 130, align: "right" });
  y += 18;
  doc.moveTo(totalsX, y).lineTo(right, y).strokeColor("#0e0e0e").lineWidth(1).stroke();
  y += 10;

  const finalBalance = totalCharged - totalPaid;
  doc.fillColor("#1a1a1a").font("Inter-Bold").fontSize(13).text("Balance Outstanding", totalsX, y, { width: 150 });
  doc.fillColor(finalBalance > 0 ? "#dc2626" : "#16a34a").font("Inter-Bold").fontSize(13)
    .text(fmt(finalBalance), totalsX + 140, y, { width: 130, align: "right" });

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
      `SELECT id, name FROM public.tenants WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
      [tenantName],
    );
    const tenantIds = tenantRes.rows.map((r: any) => String(r.id));

    if (!tenantIds.length) {
      return NextResponse.json({ ok: false, error: "No tenants found with that name" }, { status: 404 });
    }

    // Fetch all invoices (charges)
    const invoicesRes = await query(
      `SELECT
         i.invoice_date,
         i.invoice_number,
         i.total_amount,
         u.unit_number
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id = i.unit_id
       WHERE i.tenant_id = ANY($1::text[])
       ORDER BY i.invoice_date ASC NULLS LAST`,
      [tenantIds],
    );

    // Fetch all payments (bank deposits allocated to this tenant)
    const paymentsRes = await query(
      `SELECT
         txn_date,
         COALESCE(payee, particulars, '') AS description,
         deposit,
         COALESCE(u.unit_number, '') AS unit_number
       FROM public.bank_transactions bt
       LEFT JOIN public.units u ON u.id::text = bt.unit_id
       WHERE bt.tenant_id = ANY($1::text[])
         AND bt.deposit > 0
       ORDER BY txn_date ASC`,
      [tenantIds],
    );

    // Build combined ledger entries
    type RawEntry = {
      date: string;
      description: string;
      unit: string;
      amount: number;
      rowType: "charge" | "payment";
    };

    const entries: RawEntry[] = [];

    for (const r of invoicesRes.rows) {
      const total = Number(r.total_amount || 0);
      let desc = `Invoice ${String(r.invoice_number || "").slice(0, 20)}`;
      if (r.invoice_date) {
        const d = new Date(r.invoice_date);
        if (!isNaN(d.getTime())) {
          const period = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
          desc = `Invoice — ${period}`;
        }
      }
      entries.push({
        date: r.invoice_date ? String(r.invoice_date).slice(0, 10) : "",
        description: desc,
        unit: r.unit_number ? `${r.unit_number}` : "—",
        amount: total,
        rowType: "charge",
      });
    }

    for (const r of paymentsRes.rows) {
      entries.push({
        date: r.txn_date ? String(r.txn_date).slice(0, 10) : "",
        description: r.description ? String(r.description).slice(0, 40) : "Payment received",
        unit: r.unit_number || "—",
        amount: Number(r.deposit || 0),
        rowType: "payment",
      });
    }

    // Sort by date ascending, charges before payments on same day
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.rowType === "charge" && b.rowType === "payment" ? -1 : 1;
    });

    // Compute running balance
    let balance = 0;
    const rows: LedgerRow[] = entries.map((e) => {
      if (e.rowType === "charge") balance += e.amount;
      else balance -= e.amount;
      return {
        date: e.date,
        description: e.description,
        unit: e.unit,
        charge: e.rowType === "charge" ? e.amount : 0,
        payment: e.rowType === "payment" ? e.amount : 0,
        balance: Number(balance.toFixed(2)),
        rowType: e.rowType,
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
