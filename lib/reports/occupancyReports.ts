import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { fetchPropertyOptions } from "@/lib/reports/propertyHelpers";
import { normalizeId, type TenantRecord } from "@/lib/reports/tenantStatement";

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

type PropertyInfo = { property_id: string; name?: string };

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

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = getRequestBaseUrl(headers());
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
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
  const match = properties.find((p) => (p.property_id || "").toLowerCase() === id.toLowerCase());
  return match?.name || id;
}

export async function buildOccupancyReport(filters: OccupancyFilters, properties: PropertyInfo[]): Promise<OccupancyReportResult> {
  const [units, turnover, tenants] = await Promise.all([
    fetchJson<UnitInventory[]>("/api/unit-inventory"),
    fetchJson<UnitTurnover[]>("/api/unit-turnover").catch(() => [] as UnitTurnover[]),
    fetchJson<TenantRecord[]>("/api/tenants"),
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
    tenantMap.set(unitKey(tenant.property_id || tenant.building, tenant.unit), tenant);
  });

  const rows: OccupancyRow[] = units
    .map((unit) => {
      const propertyId = unit.property_id || "";
      if (propertyFilter && propertyId.toLowerCase() !== propertyFilter) return null;
      if (bedsFilter && String(unit.beds || "").toLowerCase() !== bedsFilter.toLowerCase()) return null;
      const turnoverRecord = turnoverMap.get(unitKey(propertyId, unit.unit));
      const tenant = tenantMap.get(unitKey(propertyId, unit.unit));
      const status = tenant ? "Occupied" : toTitle(unit.status) === "Occupied" ? "Occupied" : "Vacant";
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
    .filter((row): row is OccupancyRow => Boolean(row))
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

export async function calculateOccupancySummary(): Promise<OccupancySummary> {
  const properties = await fetchPropertyOptions();
  const { summary } = await buildOccupancyReport({}, properties);
  return summary;
}
