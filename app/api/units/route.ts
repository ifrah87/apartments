import { NextRequest, NextResponse } from "next/server";
import { RepoError, datasetsRepo, propertiesRepo, tenantsRepo, unitsRepo } from "@/lib/repos";
import type { LeaseAgreement } from "@/lib/leases";
import { normalizeId } from "@/lib/reports/tenantStatement";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const data = await unitsRepo.listUnits({ propertyId });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/units failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = await unitsRepo.createUnit(payload);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/units POST failed:", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    const data = await unitsRepo.updateUnit(String(payload.id), payload);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/units PUT failed:", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    const unitId = String(payload.id);
    const force = Boolean(payload.force);
    const unit = await unitsRepo.getUnit(unitId);
    if (!unit) {
      return NextResponse.json({ ok: false, error: "Unit not found." }, { status: 404 });
    }

    let deletedTenants: string[] = [];
    let deletedLeases: string[] = [];
    if (force) {
      const [properties, tenants, leases] = await Promise.all([
        propertiesRepo.listProperties(),
        tenantsRepo.listTenants(),
        datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []),
      ]);

      const propertyCandidates = new Set<string>();
      if (unit.property_id) propertyCandidates.add(unit.property_id.toLowerCase());
      const property = properties.find((p) => p.property_id === unit.property_id);
      if (property?.name) propertyCandidates.add(property.name.toLowerCase());
      if (property?.building) propertyCandidates.add(property.building.toLowerCase());

      const unitLabel = (unit.unit || "").trim().toLowerCase();
      const matchesProperty = (value?: string | null) => {
        if (!propertyCandidates.size) return true;
        const key = (value || "").trim().toLowerCase();
        return key ? propertyCandidates.has(key) : false;
      };

      const matchingTenants = tenants.filter((tenant) => {
        if (!tenant.unit || tenant.unit.trim().toLowerCase() !== unitLabel) return false;
        return matchesProperty(tenant.property_id) || matchesProperty(tenant.building);
      });

      for (const tenant of matchingTenants) {
        await tenantsRepo.deleteTenant(tenant.id);
        deletedTenants.push(tenant.id);
      }

      const normalizedLeases = Array.isArray(leases) ? leases : [];
      const remainingLeases = normalizedLeases.filter((lease) => {
        const leaseUnit = (lease.unit || "").trim().toLowerCase();
        if (leaseUnit !== unitLabel) return true;
        if (!propertyCandidates.size) return false;
        const leaseProperty = (lease.property || "").trim().toLowerCase();
        return !propertyCandidates.has(leaseProperty);
      });
      deletedLeases = normalizedLeases
        .filter((lease) => !remainingLeases.some((remaining) => remaining.id === lease.id))
        .map((lease) => lease.id);
      if (deletedLeases.length) {
        await datasetsRepo.setDataset<LeaseAgreement[]>("lease_agreements", remainingLeases);
      }

      const tenantIds = new Set(matchingTenants.map((tenant) => normalizeId(tenant.id)));
      if (tenantIds.size) {
        await datasetsRepo.updateDataset<any[]>(
          "tenant_deposits",
          (current) => (Array.isArray(current) ? current.filter((row) => !tenantIds.has(normalizeId(row?.tenant_id))) : []),
          [],
        );
        await datasetsRepo.updateDataset<any[]>(
          "deposit_transactions",
          (current) => (Array.isArray(current) ? current.filter((row) => !tenantIds.has(normalizeId(row?.tenant_id))) : []),
          [],
        );
        await datasetsRepo.updateDataset<any[]>(
          "tenant_charges",
          (current) => (Array.isArray(current) ? current.filter((row) => !tenantIds.has(normalizeId(row?.tenant_id))) : []),
          [],
        );
        await datasetsRepo.updateDataset<any[]>(
          "manual_payments",
          (current) => (Array.isArray(current) ? current.filter((row) => !tenantIds.has(normalizeId(row?.tenant_id))) : []),
          [],
        );
      }
    }

    await unitsRepo.deleteUnit(unitId);
    return NextResponse.json({ ok: true, deletedTenants, deletedLeases });
  } catch (err) {
    console.error("❌ /api/units DELETE failed:", err);
    return handleError(err);
  }
}
