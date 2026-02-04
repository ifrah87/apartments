import { randomUUID } from "crypto";
import { query } from "@/lib/db/client";
import { badRequest, notFound } from "./errors";

export type UnitRecord = {
  id: string;
  property_id?: string | null;
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

function normalizeUnitRow(row: any): UnitRecord {
  return {
    id: String(row.id),
    property_id: row.property_id ?? null,
    unit: row.unit,
    floor: row.floor ?? null,
    type: row.type ?? null,
    beds: row.beds ?? null,
    rent: row.rent !== null && row.rent !== undefined ? Number(row.rent) : null,
    status: row.status ?? null,
  };
}

function normalizeUnitInput(payload: UnitInput, requireUnit = true) {
  const unit = payload.unit?.trim();
  if (requireUnit && !unit) {
    throw badRequest("Unit label is required.");
  }
  return {
    id: payload.id ? String(payload.id) : undefined,
    property_id: payload.property_id ?? null,
    unit: unit ?? payload.unit,
    floor: payload.floor ?? null,
    type: payload.type ?? null,
    beds: payload.beds ?? null,
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
    `SELECT id, property_id, unit, floor, type, beds, rent, status
     FROM units
     ${where}
     ORDER BY unit ASC`,
    params,
  );
  return rows.map(normalizeUnitRow);
}

export async function getUnit(id: string): Promise<UnitRecord | null> {
  if (!id) throw badRequest("Unit id is required.");
  const { rows } = await query(
    `SELECT id, property_id, unit, floor, type, beds, rent, status
     FROM units
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) return null;
  return normalizeUnitRow(rows[0]);
}

export async function createUnit(payload: UnitInput): Promise<UnitRecord> {
  const normalized = normalizeUnitInput(payload);
  const id = normalized.id ?? randomUUID();
  const { rows } = await query(
    `INSERT INTO units (id, property_id, unit, floor, type, beds, rent, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, property_id, unit, floor, type, beds, rent, status`,
    [
      id,
      normalized.property_id,
      normalized.unit,
      normalized.floor,
      normalized.type,
      normalized.beds,
      normalized.rent,
      normalized.status,
    ],
  );
  return normalizeUnitRow(rows[0]);
}

export async function updateUnit(id: string, payload: UnitInput): Promise<UnitRecord> {
  if (!id) throw badRequest("Unit id is required.");
  const normalized = normalizeUnitInput(payload, false);
  const fields: string[] = [];
  const params: any[] = [];
  const mapping: Array<[keyof typeof normalized, string]> = [
    ["property_id", "property_id"],
    ["unit", "unit"],
    ["floor", "floor"],
    ["type", "type"],
    ["beds", "beds"],
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
     RETURNING id, property_id, unit, floor, type, beds, rent, status`,
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
