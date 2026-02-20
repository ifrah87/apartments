import { NextResponse } from "next/server";
import { datasetsRepo, RepoError, tenantsRepo } from "@/lib/repos";
import type { LeaseAgreement } from "@/lib/leases";
import { normalizeId } from "@/lib/reports/tenantStatement";

const DATASET_KEY = "deposit_transactions";
const LEASES_KEY = "lease_agreements";

function normalizeKey(value?: string) {
  return (value || "").trim().toLowerCase();
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function buildTenantLookup(tenants: Awaited<ReturnType<typeof tenantsRepo.listTenants>>) {
  const byUnit = new Map<string, { id: string }>();
  tenants.forEach((tenant) => {
    const unit = normalizeKey(tenant.unit || "");
    if (!unit) return;
    const property = normalizeKey(tenant.property_id || tenant.building || "");
    const id = normalizeId(tenant.id);
    if (property) byUnit.set(`${property}::${unit}`, { id });
    byUnit.set(`::${unit}`, { id });
  });
  return { byUnit };
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<any[]>(DATASET_KEY, []);
    if (Array.isArray(data) && data.length) {
      return NextResponse.json({ ok: true, data });
    }

    const [leases, tenants] = await Promise.all([
      datasetsRepo.getDataset<LeaseAgreement[]>(LEASES_KEY, []),
      tenantsRepo.listTenants(),
    ]);
    const tenantIndex = buildTenantLookup(tenants);

    const generated = leases
      .filter((lease) => lease && lease.deposit && lease.deposit > 0)
      .map((lease) => {
        const unit = normalizeKey(lease.unit);
        if (!unit) return null;
        const propertyKey = normalizeKey(lease.property || "");
        const tenant = tenantIndex.byUnit.get(`${propertyKey}::${unit}`) || tenantIndex.byUnit.get(`::${unit}`);
        if (!tenant?.id) return null;
        return {
          tenant_id: tenant.id,
          date: parseDate(lease.startDate) || new Date().toISOString().slice(0, 10),
          type: "received",
          amount: toNumber(lease.deposit),
          note: "From lease agreement",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return NextResponse.json({ ok: true, data: generated });
  } catch (err) {
    console.error("❌ failed to load deposit transactions", err);
    return handleError(err);
  }
}
