import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { RepoError, tenantsRepo } from "@/lib/repos";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { LeaseAgreement, LeaseAgreementStatus, LeaseBillingCycle } from "@/lib/leases";
import { query } from "@/lib/db";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(status?: string): LeaseAgreementStatus {
  if (!status) return "Active";
  const normalized = status.toLowerCase();
  if (normalized.includes("term")) return "Terminated";
  if (normalized.includes("pending")) return "Pending";
  return "Active";
}

function normalizeCycle(cycle?: string): LeaseBillingCycle {
  if (!cycle) return "Monthly";
  const normalized = cycle.toLowerCase();
  if (normalized.includes("quarter")) return "Quarterly";
  if (normalized.includes("semi")) return "Semi-Annually";
  if (normalized.includes("annual")) return "Annually";
  return "Monthly";
}

async function upsertTenantFromLease(lease: LeaseAgreement, preferredTenantId?: string | null): Promise<TenantRecord | null> {
  if (!lease?.tenantName || !lease?.unit) return null;
  const propertyKey = lease.property ? String(lease.property) : "";
  try {
    const tenantPayload = {
      name: lease.tenantName,
      phone: lease.tenantPhone || null,
      unit: lease.unit,
      property_id: propertyKey || null,
      building: propertyKey || null,
      monthly_rent: toNumber(lease.rent),
    };
    if (preferredTenantId) {
      try {
        return await tenantsRepo.updateTenant(preferredTenantId, tenantPayload);
      } catch {
        return await tenantsRepo.createTenant({ id: preferredTenantId, ...tenantPayload });
      }
    }
    const existing = await query<{ id: string }>(
      `SELECT id
       FROM public.tenants
       WHERE lower(trim(name)) = lower(trim($1))
         AND (trim(COALESCE(unit, '')) = trim($2) OR trim($2) = '')
         AND ($3::text = '' OR property_id::text = $3::text OR building::text = $3::text)
       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 1`,
      [lease.tenantName, lease.unit, propertyKey],
    );
    if (existing.rows[0]?.id) {
      return await tenantsRepo.updateTenant(String(existing.rows[0].id), tenantPayload);
    }
    return await tenantsRepo.createTenant(tenantPayload);
  } catch (err) {
    console.warn("⚠️ failed to sync tenant from lease", err);
    return null;
  }
}

function toSqlLeaseStatus(status: LeaseAgreementStatus) {
  if (status === "Terminated") return "ended";
  if (status === "Pending") return "draft";
  return "active";
}

function fromSqlLeaseStatus(status?: string): LeaseAgreementStatus {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "ended") return "Terminated";
  if (normalized === "draft") return "Pending";
  return "Active";
}

async function resolveUnitAndTenant(lease: LeaseAgreement) {
  return resolveUnitAndTenantWithPreferredTenant(lease);
}

async function resolveUnitAndTenantWithPreferredTenant(lease: LeaseAgreement, preferredTenantId?: string | null) {
  const unitValue = String(lease.unit || "").trim();
  const propertyValue = String(lease.property || "").trim();
  const tenantName = String(lease.tenantName || "").trim();
  if (!unitValue || !tenantName) return null;

  const unitRes = await query<{ id: string }>(
    `SELECT id
     FROM public.units
     WHERE unit_number::text = $1
       AND ($2::text = '' OR property_id::text = $2::text)
     ORDER BY created_at DESC
     LIMIT 1`,
    [unitValue, propertyValue],
  );
  const unitId = unitRes.rows[0]?.id;
  if (!unitId) return null;

  if (preferredTenantId) {
    return { unitId, tenantId: String(preferredTenantId) };
  }

  const tenantRes = await query<{ id: string }>(
    `SELECT id
     FROM public.tenants
     WHERE lower(name) = lower($1)
       AND (unit::text = $2 OR $2 = '')
       AND ($3::text = '' OR property_id::text = $3::text OR building::text = $3::text)
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [tenantName, unitValue, propertyValue],
  );
  const tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) return null;

  return { unitId, tenantId };
}

async function upsertSqlLeaseFromAgreement(lease: LeaseAgreement, preferredTenantId?: string | null) {
  const resolved = await resolveUnitAndTenantWithPreferredTenant(lease, preferredTenantId);
  if (!resolved) return;
  const startDate = String(lease.startDate || "").trim();
  if (!startDate) return;
  const sqlStatus = toSqlLeaseStatus(normalizeStatus(lease.status));
  const endDate = String(lease.endDate || "").trim() || null;
  await query(
    `INSERT INTO public.leases (external_id, unit_id, tenant_id, start_date, end_date, rent, status, is_deleted, deleted_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, NULL, now())
     ON CONFLICT (external_id)
     DO UPDATE SET
       unit_id = EXCLUDED.unit_id,
       tenant_id = EXCLUDED.tenant_id,
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       rent = EXCLUDED.rent,
       status = EXCLUDED.status,
       is_deleted = false,
       deleted_at = NULL,
       updated_at = now()`,
    [lease.id, resolved.unitId, resolved.tenantId, startDate, endDate, toNumber(lease.rent), sqlStatus],
  );
}

async function softDeleteSqlLease(externalId: string) {
  await query(
    `UPDATE public.leases
       SET is_deleted = true,
           deleted_at = now(),
           status = 'ended',
           updated_at = now()
     WHERE external_id = $1`,
    [externalId],
  );
}

async function getSqlLeaseBinding(externalId: string) {
  const { rows } = await query<{ tenant_id: string | null }>(
    `SELECT tenant_id::text AS tenant_id
     FROM public.leases
     WHERE external_id = $1
       AND COALESCE(is_deleted, false) = false
     LIMIT 1`,
    [externalId],
  );
  return rows[0] ?? null;
}

async function listAgreementsFromSql(): Promise<LeaseAgreement[]> {
  const { rows } = await query<{
    external_id: string | null;
    property_id: string | null;
    unit_number: string | number | null;
    tenant_name: string | null;
    tenant_phone: string | null;
    rent: number | null;
    start_date: string | Date | null;
    end_date: string | Date | null;
    status: string | null;
    created_at: string | Date | null;
  }>(
    `SELECT
       l.external_id,
       u.property_id::text AS property_id,
       u.unit_number,
       t.name AS tenant_name,
       t.phone AS tenant_phone,
       l.rent,
       l.start_date,
       l.end_date,
       l.status,
       l.created_at
     FROM public.leases l
     JOIN public.units u ON u.id = l.unit_id
     JOIN public.tenants t ON t.id = l.tenant_id
     WHERE COALESCE(l.is_deleted, false) = false
     ORDER BY l.start_date DESC, l.created_at DESC`,
  );

  return rows.map((row) => ({
    id: String(row.external_id || crypto.randomUUID()),
    property: String(row.property_id || ""),
    unit: String(row.unit_number ?? ""),
    tenantName: String(row.tenant_name || ""),
    tenantPhone: String(row.tenant_phone || ""),
    status: fromSqlLeaseStatus(row.status || "active"),
    cycle: "Monthly",
    rent: toNumber(row.rent),
    deposit: 0,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : "",
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
    leaseDuration: "Manual Date / Open",
  }));
}

export async function GET() {
  try {
    const data = await listAgreementsFromSql();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ failed to load lease agreements", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<LeaseAgreement>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ ok: false, error: "Invalid lease payload." }, { status: 400 });
    }
    if (!payload.unit || !payload.tenantName || !payload.startDate) {
      return NextResponse.json({ ok: false, error: "Unit, tenant name, and start date are required." }, { status: 400 });
    }

    const entry: LeaseAgreement = {
      id: payload.id ?? crypto.randomUUID(),
      property: payload.property ? String(payload.property) : "",
      unit: String(payload.unit),
      tenantName: String(payload.tenantName),
      tenantPhone: payload.tenantPhone ? String(payload.tenantPhone) : "",
      status: normalizeStatus(payload.status),
      cycle: normalizeCycle(payload.cycle),
      rent: toNumber(payload.rent),
      deposit: toNumber(payload.deposit),
      startDate: String(payload.startDate),
      endDate: payload.endDate ? String(payload.endDate) : "",
      leaseDuration: payload.leaseDuration ? String(payload.leaseDuration) : "Manual Date / Open",
    };

    const tenant = await upsertTenantFromLease(entry);
    await upsertSqlLeaseFromAgreement(entry, tenant?.id ?? null);
    const updated = await listAgreementsFromSql();

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to create lease agreement", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<LeaseAgreement>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ ok: false, error: "Invalid lease payload." }, { status: 400 });
    }
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Lease id is required." }, { status: 400 });
    }
    const current = await listAgreementsFromSql();
    const currentLease = current.find((item) => item.id === payload.id);
    if (!currentLease) {
      return NextResponse.json({ ok: false, error: "Lease not found." }, { status: 404 });
    }
    const nextLease: LeaseAgreement = {
      ...currentLease,
      property: payload.property !== undefined ? String(payload.property) : currentLease.property,
      unit: payload.unit ? String(payload.unit) : currentLease.unit,
      tenantName: payload.tenantName ? String(payload.tenantName) : currentLease.tenantName,
      tenantPhone: payload.tenantPhone !== undefined ? String(payload.tenantPhone) : currentLease.tenantPhone,
      status: payload.status ? normalizeStatus(payload.status) : currentLease.status,
      cycle: payload.cycle ? normalizeCycle(payload.cycle) : currentLease.cycle,
      rent: payload.rent !== undefined ? toNumber(payload.rent) : currentLease.rent,
      deposit: payload.deposit !== undefined ? toNumber(payload.deposit) : currentLease.deposit,
      startDate: payload.startDate ? String(payload.startDate) : currentLease.startDate,
      endDate: payload.endDate !== undefined ? String(payload.endDate) : currentLease.endDate,
      leaseDuration: payload.leaseDuration ? String(payload.leaseDuration) : currentLease.leaseDuration,
    };
    const binding = await getSqlLeaseBinding(String(payload.id));
    const tenant = await upsertTenantFromLease(nextLease, binding?.tenant_id ?? null);
    await upsertSqlLeaseFromAgreement(nextLease, tenant?.id ?? binding?.tenant_id ?? null);
    const updated = await listAgreementsFromSql();

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to update lease agreement", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "Lease id is required." }, { status: 400 });
    }
    await softDeleteSqlLease(String(payload.id));
    const updated = await listAgreementsFromSql();

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to delete lease agreement", err);
    return handleError(err);
  }
}
