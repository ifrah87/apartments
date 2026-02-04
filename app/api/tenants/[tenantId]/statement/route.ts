import { NextRequest, NextResponse } from "next/server";
import { ChargeEntry, PaymentEntry, StatementRow, createStatement, normalizeId } from "@/lib/reports/tenantStatement";
import { listManualPayments } from "@/lib/reports/manualPayments";
import { bankTransactionsRepo, tenantsRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
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
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const normalizedTenantId = normalizeId(tenantId);
    const tenantIdValue = normalizedTenantId;
    let tenant = await tenantsRepo.getTenant(tenantIdValue);

    if (!tenant) {
      const allTenants = await tenantsRepo.listTenants();
      tenant = allTenants.find((t) => normalizeId(t.reference) === tenantIdValue) || null;
    }

    if (!tenant) {
      return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
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
      return NextResponse.json({ ok: false, error: "Start date must be before end date" }, { status: 400 });
    }

    const tenantName = (tenant.name || "").toLowerCase();
    const unitRef = (tenant.reference || "").toLowerCase();

    const bankTransactions = await bankTransactionsRepo.listTransactions();
    const payments: PaymentEntry[] = bankTransactions
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
          normalizedId === tenantIdValue ||
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

    const manualPayments = await listManualPayments();
    const manualEntries: PaymentEntry[] = manualPayments
      .filter((entry) => normalizeId(entry.tenant_id) === tenantIdValue)
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

    const additionalCharges: ChargeEntry[] = [];

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
        unit: tenant.unit ?? undefined,
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
          "Content-Disposition": `attachment; filename=\"tenant-statement-${tenantIdValue}-${payload.period.start}-to-${payload.period.end}.csv\"`,
        },
      });
    }

    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    console.error("❌ failed to build tenant statement", err);
    return handleError(err);
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
