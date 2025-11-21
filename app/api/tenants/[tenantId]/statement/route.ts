import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import papa from "papaparse";
import { ChargeEntry, PaymentEntry, StatementRow, createStatement, normalizeId } from "@/lib/reports/tenantStatement";
import { listManualPayments } from "@/lib/reports/manualPayments";

function readCsv<T = any>(fileName: string): T[] {
  const filePath = path.join(process.cwd(), "data", fileName);
  const csvText = fs.readFileSync(filePath, "utf8");
  const parsed = papa.parse(csvText, { header: true, skipEmptyLines: true });
  return (parsed.data as T[]).filter(Boolean);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  try {
    const tenantId = normalizeId(params.tenantId);
    const tenants = readCsv<any>("tenants_all_buildings_simple_unique.csv");
    const tenant =
      tenants.find((t) => normalizeId(t.id) === tenantId) ||
      tenants.find((t) => normalizeId(t.reference) === tenantId);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const endRaw = parseDate(searchParams.get("end")) ?? new Date();
    const startRaw =
      parseDate(searchParams.get("start")) ??
      (() => {
        const d = new Date(endRaw);
        d.setUTCMonth(d.getUTCMonth() - 2);
        d.setUTCDate(1);
        return d;
      })();
    const end = normalizeDay(endRaw);
    const start = normalizeDay(startRaw);

    if (start > end) {
      return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
    }

    const tenantName = (tenant.name || "").toLowerCase();
    const unitRef = (tenant.reference || "").toLowerCase();
    const paymentsRaw = readCsv<any>("bank_all_buildings_simple.csv");
    const manualPayments = listManualPayments();
    const chargeRows = readCsv<any>("tenant_charges.csv");
    const payments: PaymentEntry[] = paymentsRaw
      .map((row) => ({
        amount: Number(row.amount || 0),
        date: row.date,
        description: row.description,
        tenant_id: row.tenant_id,
      }))
      .filter((row) => {
        const normalizedId = normalizeId(row.tenant_id);
        const desc = (row.description || "").toLowerCase();
        return (
          normalizedId === tenantId ||
          (unitRef && desc.includes(unitRef)) ||
          (tenantName && desc.includes(tenantName))
        );
      })
      .filter((row) => {
        const d = parseDate(row.date);
        if (!d) return false;
        const normalized = normalizeDay(d);
        return normalized >= start && normalized <= end;
      })
      .map((row) => ({
        date: row.date,
        amount: row.amount,
        description: row.description,
        source: "bank",
      }));

    const manualEntries: PaymentEntry[] = manualPayments
      .filter((entry) => normalizeId(entry.tenant_id) === tenantId)
      .map((entry) => ({
        description: entry.description || "Manual payment",
        amount: Number(entry.amount || 0),
        date: entry.date,
        source: "manual",
      }))
      .filter((entry) => {
        const d = parseDate(entry.date);
        if (!d) return false;
        const normalized = normalizeDay(d);
        return normalized >= start && normalized <= end;
      });

    const additionalCharges: ChargeEntry[] = chargeRows
      .filter((entry) => normalizeId(entry.tenant_id) === tenantId)
      .map((entry) => ({
        date: entry.date,
        amount: Number(entry.amount || 0),
        description: entry.description || "Charge",
        category: entry.category,
      }))
      .filter((entry) => {
        const d = parseDate(entry.date);
        if (!d) return false;
        const normalized = normalizeDay(d);
        return normalized >= start && normalized <= end;
      });

    const { rows, totals } = createStatement({
      tenant,
      start,
      end,
      payments: [...payments, ...manualEntries],
      additionalCharges,
    });

    const payload = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        property: tenant.building || tenant.property_id,
        unit: tenant.unit,
        monthlyRent: Number(tenant.monthly_rent || 0),
        dueDay: Number(tenant.due_day || 1),
      },
      period: { start: toISO(start), end: toISO(end) },
      totals,
      rows,
    };

    if (searchParams.get("format") === "csv") {
      const csv = buildStatementCsv(payload.rows, payload.tenant.name, payload.tenant.unit, payload.period);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=\"tenant-statement-${tenantId}-${payload.period.start}-to-${payload.period.end}.csv\"`,
        },
      });
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("❌ failed to build tenant statement", err);
    return NextResponse.json({ error: "Failed to build statement" }, { status: 500 });
  }
}

function buildStatementCsv(rows: StatementRow[], tenantName: string, unit: string | undefined, period: { start: string; end: string }) {
  const lines: string[] = [];
  lines.push(`Tenant,${csvValue(tenantName)}`);
  lines.push(`Unit,${csvValue(unit || "—")}`);
  lines.push(`Period,${csvValue(`${period.start} – ${period.end}`)}`);
  lines.push("");
  lines.push(["Date", "Type", "Description", "Charge", "Payment", "Balance", "Source"].map(csvValue).join(","));
  rows.forEach((row) => {
    lines.push(
      [
        row.date,
        row.entryType,
        row.description,
        row.charge ? row.charge.toFixed(2) : "",
        row.payment ? row.payment.toFixed(2) : "",
        row.balance.toFixed(2),
        row.source || "",
      ]
        .map(csvValue)
        .join(","),
    );
  });
  return lines.join("\n");
}

function csvValue(value: string) {
  const needsQuotes = /[",\n]/.test(value);
  const safe = value.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
}
