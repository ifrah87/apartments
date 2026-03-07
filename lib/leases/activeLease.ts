import { toDateOnlyString } from "@/lib/dateOnly";
import { query } from "@/lib/db";

export type ActiveLeaseRecord = {
  id: string;
  unit_id: string;
  tenant_id: string;
  rent: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
};

function asDateOnly(value?: string | Date | null) {
  return toDateOnlyString(value || new Date());
}

export async function getActiveLeaseForUnit(unitId: string, asOfDate?: string | Date | null) {
  const dateKey = asDateOnly(asOfDate);
  const { rows } = await query<ActiveLeaseRecord>(
    `SELECT id, unit_id, tenant_id, rent, start_date, end_date, status
     FROM public.leases
     WHERE unit_id = $1
       AND COALESCE(is_deleted, false) = false
       AND lower(status) = 'active'
       AND start_date <= $2
       AND (end_date IS NULL OR end_date >= $2)
     ORDER BY start_date DESC
     LIMIT 1`,
    [unitId, dateKey],
  );
  return rows[0] ?? null;
}

export async function listActiveLeaseOccupancy(asOfDate?: string | Date | null) {
  const dateKey = asDateOnly(asOfDate);
  const { rows } = await query<{
    lease_id: string;
    tenant_id: string;
    unit_id: string;
    property_id: string | null;
    unit_number: string | number | null;
  }>(
    `SELECT
       l.id AS lease_id,
       l.tenant_id,
       l.unit_id,
       u.property_id,
       u.unit_number
     FROM public.leases l
     JOIN public.units u ON u.id = l.unit_id
     WHERE lower(l.status) = 'active'
       AND COALESCE(l.is_deleted, false) = false
       AND l.start_date <= $1
       AND (l.end_date IS NULL OR l.end_date >= $1)`,
    [dateKey],
  );
  return rows;
}
