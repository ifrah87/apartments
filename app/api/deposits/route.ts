import { NextResponse } from "next/server";
import { datasetsRepo, RepoError, tenantsRepo } from "@/lib/repos";
import type { LeaseAgreement } from "@/lib/leases";
import { normalizeId } from "@/lib/reports/tenantStatement";

const DATASET_KEY = "tenant_deposits";
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
  const byId = new Map<string, { id: string; property?: string; unit?: string }>();
  const byUnit = new Map<string, { id: string; property?: string; unit?: string }>();
  tenants.forEach((tenant) => {
    const id = normalizeId(tenant.id);
    if (id) byId.set(id, { id, property: tenant.property_id || tenant.building || "", unit: tenant.unit || "" });
    const unit = normalizeKey(tenant.unit || "");
    if (!unit) return;
    const property = normalizeKey(tenant.property_id || tenant.building || "");
    if (property) byUnit.set(`${property}::${unit}`, { id, property: tenant.property_id || tenant.building || "", unit: tenant.unit || "" });
    byUnit.set(`::${unit}`, { id, property: tenant.property_id || tenant.building || "", unit: tenant.unit || "" });
  });
  return { byId, byUnit };
}

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<any[]>(DATASET_KEY, []);
    const rows = Array.isArray(data) ? data : [];
    const map = new Map<string, any>();
    rows.forEach((row) => {
      const id = normalizeId(row?.tenant_id);
      if (id) map.set(id, row);
    });

    const [leases, tenants] = await Promise.all([
      datasetsRepo.getDataset<LeaseAgreement[]>(LEASES_KEY, []),
      tenantsRepo.listTenants(),
    ]);
    const tenantIndex = buildTenantLookup(tenants);

    leases
      .filter((lease) => lease && lease.deposit && lease.deposit > 0)
      .forEach((lease) => {
        const unit = normalizeKey(lease.unit);
        if (!unit) return;
        const propertyKey = normalizeKey(lease.property || "");
        const tenant =
          tenantIndex.byUnit.get(`${propertyKey}::${unit}`) || tenantIndex.byUnit.get(`::${unit}`) || null;
        if (!tenant) return;
        const tenantId = normalizeId(tenant.id);
        if (!tenantId || map.has(tenantId)) return;
        const deposit = toNumber(lease.deposit);
        map.set(tenantId, {
          tenant_id: tenantId,
          deposit_charged: deposit,
          deposit_received: deposit,
          deposit_released: 0,
          deposit_notes: "From lease agreement",
        });
      });

    return NextResponse.json({ ok: true, data: Array.from(map.values()) });
  } catch (err) {
    console.error("❌ failed to load deposits", err);
    return handleError(err);
  }
}
