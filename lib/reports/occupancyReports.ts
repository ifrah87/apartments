import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import type { PropertyInfo } from "@/lib/reports/rentInsights";
import { normalizeId } from "@/lib/reports/tenantStatement";
import type { TenantRecord } from "@/src/lib/repos/tenantsRepo";
import { opt } from "@/src/lib/utils/normalize";
import { listActiveLeaseOccupancy } from "@/lib/leases/activeLease";
import { query } from "@/lib/db";
import { datasetsRepo } from "@/lib/repos";
import type { LeaseAgreement } from "@/lib/leases";

type UnitInventory = {
  property_id: string;
  unit: string;
  unit_type?: string;
  beds?: string;
  floor?: string;
  rent?: string;
  status?: string;
};

type UnitTurnover = {
  property_id: string;
  unit: string;
  last_move_in?: string;
  last_move_out?: string;
  days_vacant_ytd?: string;
  notes?: string;
};

export type OccupancyFilters = {
  propertyId?: string;
  status?: "all" | "occupied" | "vacant";
  beds?: string;
};

export type OccupancyRow = {
  propertyId: string;
  propertyName?: string;
  unit: string;
  unitType?: string;
  beds?: string;
  floor?: string;
  status: "Occupied" | "Vacant";
  tenant?: string;
  monthlyRent: number;
  daysVacant: number;
  lastMoveIn?: string;
  lastMoveOut?: string;
  notes?: string;
};

export type OccupancyReportResult = {
  summary: OccupancySummary;
  rows: OccupancyRow[];
};

export type OccupancySummary = {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  expectedRent: number;
  averageDaysVacant: number;
};

export type TurnoverSummary = {
  turnoverRate: number;
  moveOuts: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = await getRequestBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch ${path} (${res.status} ${res.statusText}) → ${body.slice(0, 300)}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Expected JSON from ${path}, got ${contentType} → ${body.slice(0, 300)}`);
  }
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || `Failed to fetch ${path}`);
  return (payload?.ok ? payload.data : payload) as T;
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function unitKey(propertyId: string | undefined, unit: string | undefined) {
  return `${(propertyId || "").toLowerCase()}::${(unit || "").toLowerCase()}`;
}

function toTitle(value: string | undefined) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function computeDaysVacant(turnover: UnitTurnover | undefined, status: string) {
  if (status.toLowerCase() !== "vacant") return 0;
  if (turnover?.days_vacant_ytd) return Number(turnover.days_vacant_ytd) || 0;
  if (turnover?.last_move_out) {
    const lastOut = new Date(turnover.last_move_out);
    if (!Number.isNaN(lastOut.getTime())) {
      const today = new Date();
      return Math.max(0, Math.round((today.getTime() - lastOut.getTime()) / 86400000));
    }
  }
  return 0;
}

function getPropertyName(id: string | undefined, properties: PropertyInfo[]) {
  if (!id) return undefined;
  const key = id.toLowerCase();
  const match = properties.find((p) => {
    if (p.id && p.id.toLowerCase() === key) return true;
    if (p.code && p.code.toLowerCase() === key) return true;
    if (p.name && p.name.toLowerCase() === key) return true;
    return false;
  });
  return match?.name || id;
}

function toDayStart(value: string | undefined | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function isLeaseAgreementActive(lease: LeaseAgreement, asOf: Date) {
  if (String(lease.status || "").toLowerCase() !== "active") return false;
  const start = toDayStart(lease.startDate);
  if (!start) return false;
  const end = toDayStart(lease.endDate);
  if (start > asOf) return false;
  if (end && end < asOf) return false;
  return true;
}

export async function buildOccupancyReport(filters: OccupancyFilters, properties: PropertyInfo[]): Promise<OccupancyReportResult> {
  const [units, turnover, tenants, activeLeaseRows] = await Promise.all([
    fetchJson<UnitInventory[]>("/api/unit-inventory").catch(() => [] as UnitInventory[]),
    fetchJson<UnitTurnover[]>("/api/unit-turnover").catch(() => [] as UnitTurnover[]),
    fetchJson<TenantRecord[]>("/api/dashboard/occupancy").catch(() => [] as TenantRecord[]),
    listActiveLeaseOccupancy(new Date()).catch(() => []),
  ]);
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const statusFilter = filters.status || "all";
  const bedsFilter = filters.beds || "";

  const turnoverMap = new Map<string, UnitTurnover>();
  turnover.forEach((record) => {
    turnoverMap.set(unitKey(record.property_id, record.unit), record);
  });

  const tenantMap = new Map<string, TenantRecord>();
  tenants.forEach((tenant) => {
    const propertyKey = opt(tenant.property_id) ?? opt(tenant.building) ?? "";
    tenantMap.set(unitKey(propertyKey, opt(tenant.unit)), tenant);
  });
  const activeLeaseUnitKeys = new Set(
    activeLeaseRows.map((row) => unitKey(String(row.property_id || ""), String(row.unit_number || ""))),
  );

  const rows = units
    .map((unit) => {
      const propertyId = unit.property_id || "";
      if (propertyFilter && propertyId.toLowerCase() !== propertyFilter) return null;
      if (bedsFilter && String(unit.beds || "").toLowerCase() !== bedsFilter.toLowerCase()) return null;
      const turnoverRecord = turnoverMap.get(unitKey(propertyId, unit.unit));
      const tenant = tenantMap.get(unitKey(propertyId, unit.unit));
      const hasActiveLease = activeLeaseUnitKeys.has(unitKey(propertyId, unit.unit));
      const status: OccupancyRow["status"] =
        hasActiveLease ? "Occupied" : "Vacant";
      if (statusFilter === "occupied" && status !== "Occupied") return null;
      if (statusFilter === "vacant" && status !== "Vacant") return null;
      const monthlyRent = toNumber(unit.rent);
      const daysVacant = computeDaysVacant(turnoverRecord, status);
      return {
        propertyId,
        propertyName: getPropertyName(propertyId, properties),
        unit: unit.unit,
        unitType: unit.unit_type,
        beds: unit.beds,
        floor: unit.floor,
        status,
        tenant: tenant?.name,
        monthlyRent,
        daysVacant,
        lastMoveIn: turnoverRecord?.last_move_in,
        lastMoveOut: turnoverRecord?.last_move_out,
        notes: turnoverRecord?.notes,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.propertyName || "").localeCompare(b.propertyName || "") || (a.unit || "").localeCompare(b.unit || ""));

  const totalUnits = rows.length;
  const occupiedUnits = rows.filter((row) => row.status === "Occupied").length;
  const vacantUnits = totalUnits - occupiedUnits;
  const expectedRent = rows.filter((row) => row.status === "Occupied").reduce((sum, row) => sum + row.monthlyRent, 0);
  const averageDaysVacant =
    rows.filter((row) => row.status === "Vacant").reduce((sum, row) => sum + row.daysVacant, 0) / (vacantUnits || 1);

  const summary: OccupancySummary = {
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyRate: totalUnits ? Math.round((occupiedUnits / Math.max(totalUnits, 1)) * 100) : 0,
    expectedRent: Number(expectedRent.toFixed(2)),
    averageDaysVacant: Number(averageDaysVacant.toFixed(1)),
  };

  return { summary, rows };
}

export async function calculateOccupancySummary(propertyId?: string): Promise<OccupancySummary> {
  try {
    const normalizedPropertyId = String(propertyId || "").trim().toLowerCase();
    const whereParts: string[] = [];
    const params: Array<string> = [];

    if (normalizedPropertyId) {
      params.push(normalizedPropertyId);
      whereParts.push(`lower(coalesce(u.property_id::text, '')) = $${params.length}`);
    }

    const asOfDateKey = new Date().toISOString().slice(0, 10);
    params.push(asOfDateKey);
    const asOfParam = `$${params.length}`;
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const { rows } = await query<{
      property_id: string | null;
      unit_number: string | number | null;
      unit_rent: number | null;
      unit_status: string | null;
      lease_id: string | null;
      lease_rent: number | null;
    }>(
      `SELECT
         u.property_id::text AS property_id,
         u.unit_number,
         u.rent AS unit_rent,
         lower(coalesce(u.status, '')) AS unit_status,
         lease.id AS lease_id,
         lease.rent AS lease_rent
       FROM public.units u
       LEFT JOIN LATERAL (
         SELECT l.id, l.rent
         FROM public.leases l
         WHERE l.unit_id = u.id
           AND lower(l.status) = 'active'
           AND l.start_date <= ${asOfParam}
           AND (l.end_date IS NULL OR l.end_date >= ${asOfParam})
         ORDER BY l.start_date DESC
         LIMIT 1
       ) lease ON TRUE
       ${whereClause}`,
      params,
    );

    const totalUnits = rows.length;
    const occupiedUnitsFromDb = rows.filter((row) => Boolean(row.lease_id)).length;
    const expectedRentFromDb = rows.reduce((sum, row) => {
      if (!row.lease_id) return sum;
      return sum + Number(row.lease_rent ?? row.unit_rent ?? 0);
    }, 0);

    if (occupiedUnitsFromDb > 0) {
      const vacantUnits = Math.max(0, totalUnits - occupiedUnitsFromDb);
      return {
        totalUnits,
        occupiedUnits: occupiedUnitsFromDb,
        vacantUnits,
        occupancyRate: totalUnits ? Math.round((occupiedUnitsFromDb / totalUnits) * 100) : 0,
        expectedRent: Number(expectedRentFromDb.toFixed(2)),
        averageDaysVacant: 0,
      };
    }

    const asOfDay = new Date();
    asOfDay.setHours(0, 0, 0, 0);
    const allProperties = await fetchPropertyOptions().catch(() => [] as PropertyInfo[]);
    const aliasToPropertyId = new Map<string, string>();
    allProperties.forEach((property) => {
      const id = (property.id || "").toLowerCase();
      if (!id) return;
      aliasToPropertyId.set(id, id);
      if (property.code) aliasToPropertyId.set(property.code.toLowerCase(), id);
      if (property.name) aliasToPropertyId.set(property.name.toLowerCase(), id);
    });
    const propertyAliasSet = normalizedPropertyId
      ? new Set(
          allProperties
            .filter((property) => (property.id || "").toLowerCase() === normalizedPropertyId)
            .flatMap((property) =>
              [property.id, property.code, property.name]
                .filter((value): value is string => Boolean(value))
                .map((value) => value.toLowerCase()),
            ),
        )
      : new Set<string>();

    const unitRowMap = new Map<
      string,
      { unitKey: string; unitRent: number }
    >();
    const unitFallbackMap = new Map<string, string | null>();
    rows.forEach((row) => {
      const propertyKey = String(row.property_id || "").toLowerCase();
      const unitKey = String(row.unit_number || "").toLowerCase();
      if (!unitKey) return;
      const canonicalKey = `${propertyKey}::${unitKey}`;
      unitRowMap.set(canonicalKey, {
        unitKey: canonicalKey,
        unitRent: Number(row.unit_rent || 0),
      });
      const fallbackKey = `::${unitKey}`;
      const existing = unitFallbackMap.get(fallbackKey);
      if (existing === undefined) {
        unitFallbackMap.set(fallbackKey, canonicalKey);
      } else if (existing !== canonicalKey) {
        unitFallbackMap.set(fallbackKey, null);
      }
    });

    const leaseAgreements = await datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []);
    const activeLeases = (Array.isArray(leaseAgreements) ? leaseAgreements : []).filter((lease) => {
      if (!lease || typeof lease !== "object") return false;
      if (!isLeaseAgreementActive(lease, asOfDay)) return false;
      if (!normalizedPropertyId) return true;
      const leaseProperty = String(lease.property || "").toLowerCase();
      if (!leaseProperty) return false;
      if (leaseProperty === normalizedPropertyId) return true;
      if (propertyAliasSet.has(leaseProperty)) return true;
      const resolved = aliasToPropertyId.get(leaseProperty);
      return Boolean(resolved && resolved === normalizedPropertyId);
    });

    const occupiedFromDataset = new Map<string, number>();
    activeLeases
      .sort((a, b) => {
        const aStart = toDayStart(a.startDate)?.getTime() ?? 0;
        const bStart = toDayStart(b.startDate)?.getTime() ?? 0;
        return bStart - aStart;
      })
      .forEach((lease) => {
        const leaseUnit = String(lease.unit || "").toLowerCase();
        if (!leaseUnit) return;
        const leasePropertyRaw = String(lease.property || "").toLowerCase();
        const leasePropertyResolved = aliasToPropertyId.get(leasePropertyRaw) || leasePropertyRaw;
        const primaryKey = `${leasePropertyResolved}::${leaseUnit}`;
        let matchedKey = unitRowMap.has(primaryKey) ? primaryKey : null;
        if (!matchedKey) {
          const fallback = unitFallbackMap.get(`::${leaseUnit}`);
          matchedKey = fallback || null;
        }
        if (!matchedKey) return;
        if (occupiedFromDataset.has(matchedKey)) return;
        const baseRent = unitRowMap.get(matchedKey)?.unitRent || 0;
        occupiedFromDataset.set(matchedKey, Number(lease.rent || baseRent || 0));
      });

    if (occupiedFromDataset.size > 0) {
      const occupiedUnits = occupiedFromDataset.size;
      const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
      const expectedRent = Array.from(occupiedFromDataset.values()).reduce((sum, rent) => sum + rent, 0);
      return {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        expectedRent: Number(expectedRent.toFixed(2)),
        averageDaysVacant: 0,
      };
    }

    const occupiedFromUnitStatus = rows.filter((row) => row.unit_status === "occupied").length;
    const expectedRentFromUnitStatus = rows.reduce((sum, row) => {
      if (row.unit_status !== "occupied") return sum;
      return sum + Number(row.unit_rent || 0);
    }, 0);
    const vacantUnits = Math.max(0, totalUnits - occupiedFromUnitStatus);
    return {
      totalUnits,
      occupiedUnits: occupiedFromUnitStatus,
      vacantUnits,
      occupancyRate: totalUnits ? Math.round((occupiedFromUnitStatus / totalUnits) * 100) : 0,
      expectedRent: Number(expectedRentFromUnitStatus.toFixed(2)),
      averageDaysVacant: 0,
    };
  } catch (err) {
    console.warn("calculateOccupancySummary fallback to dataset report", err);
    const properties = await fetchPropertyOptions();
    const { summary } = await buildOccupancyReport({ propertyId }, properties);
    return summary;
  }
}
