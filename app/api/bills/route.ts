import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { datasetsRepo, tenantsRepo, unitsRepo, type RepoError } from "@/lib/repos";
import { createStatement, normalizeId, type TenantRecord } from "@/lib/reports/tenantStatement";

export const runtime = "nodejs";

type ChargeRow = {
  tenant_id: string;
  date: string;
  amount: string | number;
  description?: string;
  category?: string;
};

type StoredInvoice = {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string;
  unitLabel: string;
  period: string;
  total: number;
  outstanding: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  createdAt: string;
  updatedAt: string;
};

const INVOICES_KEY = "billing_invoices";
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

function handleError(err: unknown) {
  const status = err instanceof Error && (err as RepoError).status ? (err as RepoError).status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function toMonthIndex(value: string) {
  const idx = MONTHS.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return idx >= 0 ? idx : null;
}

function monthLabel(reference: Date) {
  return reference.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthRange(reference: Date) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return { start, end };
}

function buildTenantIndex(tenants: TenantRecord[]) {
  const map = new Map<string, TenantRecord>();
  tenants.forEach((tenant) => {
    const unit = tenant.unit || "";
    if (!unit) return;
    const property = tenant.property_id || tenant.building || "";
    map.set(`${property}::${unit}`.toLowerCase(), tenant);
    map.set(`::${unit}`.toLowerCase(), tenant);
  });
  return map;
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<StoredInvoice[]>(INVOICES_KEY, []);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ failed to load bills", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as { unitIds?: string[]; month?: string; year?: string };
    const unitIds = Array.isArray(payload?.unitIds) ? payload.unitIds.filter(Boolean) : [];
    if (!unitIds.length) {
      return NextResponse.json({ ok: false, error: "Select at least one unit." }, { status: 400 });
    }

    const monthValue = payload?.month || "";
    const monthIndex = toMonthIndex(monthValue);
    const year = Number(payload?.year);
    if (monthIndex === null || !Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Invalid month or year." }, { status: 400 });
    }

    const reference = new Date(Date.UTC(year, monthIndex, 1));
    const period = monthLabel(reference);
    const periodKey = `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthRange(reference);

    const [units, tenants, charges] = await Promise.all([
      unitsRepo.listUnits(),
      tenantsRepo.listTenants(),
      datasetsRepo.getDataset<ChargeRow[]>("tenant_charges", []),
    ]);

    const tenantIndex = buildTenantIndex(tenants);
    const chargeIndex = new Map<string, ChargeRow[]>();
    charges.forEach((row) => {
      const tenantId = normalizeId(row.tenant_id);
      if (!tenantId) return;
      if (!chargeIndex.has(tenantId)) {
        chargeIndex.set(tenantId, []);
      }
      chargeIndex.get(tenantId)!.push(row);
    });

    const now = new Date().toISOString();
    const created: StoredInvoice[] = [];
    const skipped: string[] = [];

    unitIds.forEach((unitId) => {
      const unit = units.find((row) => row.id === unitId);
      if (!unit) {
        skipped.push(unitId);
        return;
      }
      const propertyKey = (unit.property_id || "").toLowerCase();
      const unitKey = `${propertyKey}::${unit.unit}`.toLowerCase();
      const tenant = tenantIndex.get(unitKey) || tenantIndex.get(`::${unit.unit}`.toLowerCase());
      if (!tenant) {
        skipped.push(unit.unit);
        return;
      }
      const tenantId = normalizeId(tenant.id);
      const { rows, totals } = createStatement({
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
        start,
        end,
        payments: [],
        additionalCharges: (chargeIndex.get(tenantId) || []).map((row) => ({
          date: row.date,
          amount: Number(row.amount || 0),
          description: row.description || "Charge",
          category: row.category,
        })),
      });

      if (!totals.charges) {
        skipped.push(unit.unit);
        return;
      }

      const id = `inv-${tenantId}-${periodKey}`;
      created.push({
        id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitId: unit.id,
        unitLabel: unit.unit ? `Unit ${unit.unit}` : `Unit ${unit.id}`,
        period,
        total: Number(totals.charges.toFixed(2)),
        outstanding: Number(totals.charges.toFixed(2)),
        status: "Unpaid",
        createdAt: now,
        updatedAt: now,
      });
    });

    if (!created.length) {
      return NextResponse.json(
        { ok: false, error: "No invoices generated. Ensure tenants and rent are set." },
        { status: 400 },
      );
    }

    const updated = await datasetsRepo.updateDataset<StoredInvoice[]>(
      INVOICES_KEY,
      (current) => {
        const map = new Map<string, StoredInvoice>();
        (Array.isArray(current) ? current : []).forEach((item) => map.set(item.id, item));
        created.forEach((item) => {
          const existing = map.get(item.id);
          map.set(item.id, existing ? { ...existing, ...item, updatedAt: now } : item);
        });
        return Array.from(map.values());
      },
      [],
    );

    return NextResponse.json({ ok: true, data: updated, created, skipped });
  } catch (err) {
    console.error("❌ failed to generate bills", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "Invoice id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<StoredInvoice[]>(
      INVOICES_KEY,
      (current) => (Array.isArray(current) ? current.filter((item) => item.id !== payload.id) : []),
      [],
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to delete bill", err);
    return handleError(err);
  }
}
