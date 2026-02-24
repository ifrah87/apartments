import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { badRequest, notFound } from "./errors";

export type UnitRecord = {
  id: string;
  property_id: string | null;
  unit: string;
  floor?: string | null;
  type?: string | null;
  beds?: string | null;
  rent?: number | null;
  status?: string | null;
};

export type UnitFilters = {
  propertyId?: string;
};

export type UnitInput = Partial<UnitRecord> & { unit?: string };

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function toInt(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;
  return Math.trunc(num);
}

type UnitType = "3bed" | "2bed" | "studio";

function normalizeUnitType(value: unknown): UnitType {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("studio")) return "studio";
  if (raw.includes("3")) return "3bed";
  if (raw.includes("2")) return "2bed";
  return "2bed";
}

function inferUnitType(unitNumber: number) {
  const slot = unitNumber % 100;
  const floor = Math.trunc(unitNumber / 100);
  if (slot === 6) return "studio";
  if (slot === 3) return "3bed";
  if (floor <= 5 && slot === 1) return "3bed";
  return "2bed";
}

function bedsFromType(unitType?: string | null) {
  if (!unitType) return null;
  if (unitType.startsWith("3")) return "3";
  if (unitType.startsWith("2")) return "2";
  if (unitType.includes("studio")) return "0";
  return null;
}

function normalizeUnitRow(row: any): UnitRecord {
  const unitNumber = row.unit_number ?? row.unitNumber ?? row.unit;
  const unitType = row.unit_type ?? row.unitType ?? row.type ?? null;
  return {
    id: String(row.id),
    property_id: row.property_id ?? null,
    unit: unitNumber !== undefined && unitNumber !== null ? String(unitNumber) : "",
    floor: row.floor !== undefined && row.floor !== null ? String(row.floor) : null,
    type: unitType,
    beds: row.beds ?? bedsFromType(unitType),
    rent: row.rent !== null && row.rent !== undefined ? Number(row.rent) : null,
    status: row.status ?? null,
  };
}

function normalizeUnitInput(payload: UnitInput, requireUnit = true, requireType = true) {
  const unitRaw = payload.unit?.trim();
  const unitNumber = unitRaw ? toInt(unitRaw) : toInt(payload.unit);
  if (requireUnit && !unitNumber) {
    throw badRequest("Unit number is required.");
  }
  const propertyId = payload.property_id ?? null;
  if (requireUnit && !propertyId) {
    throw badRequest("property_id is required.");
  }
  const floor = toInt(payload.floor) ?? (unitNumber ? Math.trunc(unitNumber / 100) : null);
  if (requireUnit && floor === null) {
    throw badRequest("Floor is required.");
  }
  let unitType: UnitType | undefined;
  if (payload.type !== undefined && payload.type !== null && payload.type !== "") {
    unitType = normalizeUnitType(payload.type);
  } else if (unitNumber) {
    unitType = inferUnitType(unitNumber);
  } else if (requireType) {
    unitType = "2bed";
  }

  return {
    id: payload.id ? String(payload.id) : undefined,
    property_id: propertyId,
    unit_number: unitNumber ?? undefined,
    floor,
    unit_type: unitType,
    rent: toNumber(payload.rent),
    status: payload.status ?? null,
  };
}

export async function listUnits(filters: UnitFilters = {}): Promise<UnitRecord[]> {
  const params: any[] = [];
  const clauses: string[] = [];
  if (filters.propertyId) {
    params.push(filters.propertyId);
    clauses.push("property_id = $1");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, property_id, unit_number, floor, unit_type, rent, status
     FROM units
     ${where}
     ORDER BY unit_number ASC`,
    params,
  );
  return rows.map(normalizeUnitRow);
}

export async function getUnit(id: string): Promise<UnitRecord | null> {
  if (!id) throw badRequest("Unit id is required.");
  const { rows } = await query(
    `SELECT id, property_id, unit_number, floor, unit_type, rent, status
     FROM units
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) return null;
  return normalizeUnitRow(rows[0]);
}

export async function createUnit(payload: UnitInput): Promise<UnitRecord> {
  const normalized = normalizeUnitInput(payload, true, true);
  const id = normalized.id ?? randomUUID();
  const { rows } = await query(
    `INSERT INTO units (id, property_id, unit_number, floor, unit_type, rent, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, property_id, unit_number, floor, unit_type, rent, status`,
    [
      id,
      normalized.property_id,
      normalized.unit_number,
      normalized.floor,
      normalized.unit_type,
      normalized.rent,
      normalized.status,
    ],
  );
  return normalizeUnitRow(rows[0]);
}

export async function updateUnit(id: string, payload: UnitInput): Promise<UnitRecord> {
  if (!id) throw badRequest("Unit id is required.");
  const normalized = normalizeUnitInput(payload, false, false);
  const fields: string[] = [];
  const params: any[] = [];
  const mapping: Array<[keyof typeof normalized, string]> = [
    ["property_id", "property_id"],
    ["unit_number", "unit_number"],
    ["floor", "floor"],
    ["unit_type", "unit_type"],
    ["rent", "rent"],
    ["status", "status"],
  ];

  mapping.forEach(([key, column]) => {
    const value = normalized[key];
    if (value !== undefined) {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    }
  });

  if (!fields.length) {
    throw badRequest("No fields provided to update.");
  }

  params.push(id);
  const { rows } = await query(
    `UPDATE units
     SET ${fields.join(", ")}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING id, property_id, unit_number, floor, unit_type, rent, status`,
    params,
  );
  if (!rows.length) throw notFound("Unit not found.");
  return normalizeUnitRow(rows[0]);
}

export async function deleteUnit(id: string): Promise<void> {
  if (!id) throw badRequest("Unit id is required.");
  await query(`DELETE FROM units WHERE id = $1`, [id]);
}

export const unitsRepo = {
  listUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
};
