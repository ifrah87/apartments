import { query } from "@/lib/db";

export type ActiveLeaseRecord = {
  lease_id: string;
  tenant_id: string;
  unit_id: string;
  rent_amount: number;
  deposit_amount: number;
  status: string;
};

async function getActiveLeaseBy(
  whereClause: string,
  param: string,
): Promise<ActiveLeaseRecord | null> {
  const { rows } = await query<{
    lease_id: string;
    tenant_id: string;
    unit_id: string;
    rent_amount: string | number | null;
    deposit_amount: string | number | null;
    status: string;
  }>(
    `SELECT
       l.id::text AS lease_id,
       l.tenant_id::text AS tenant_id,
       l.unit_id::text AS unit_id,
       COALESCE(l.rent, 0)::numeric AS rent_amount,
       COALESCE(dep.deposit_amount, 0)::numeric AS deposit_amount,
       l.status
     FROM public.leases l
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(d.amount), 0)::numeric AS deposit_amount
       FROM public.deposits d
       WHERE d.lease_id = l.id
         AND d.refunded_date IS NULL
     ) dep ON true
     WHERE ${whereClause}
       AND lower(l.status) = 'active'
       AND COALESCE(l.is_deleted, false) = false
       AND l.start_date <= CURRENT_DATE
       AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
     ORDER BY l.start_date DESC, l.created_at DESC
     LIMIT 1`,
    [param],
  );

  const row = rows[0];
  if (!row) return null;
  return {
    lease_id: String(row.lease_id),
    tenant_id: String(row.tenant_id),
    unit_id: String(row.unit_id),
    rent_amount: Number(row.rent_amount ?? 0),
    deposit_amount: Number(row.deposit_amount ?? 0),
    status: String(row.status || "active"),
  };
}

export async function getActiveLeaseByUnit(unit_id: string) {
  if (!unit_id) return null;
  return getActiveLeaseBy("l.unit_id::text = $1::text", unit_id);
}

export async function getActiveLeaseByTenant(tenant_id: string) {
  if (!tenant_id) return null;
  return getActiveLeaseBy("l.tenant_id::text = $1::text", tenant_id);
}
