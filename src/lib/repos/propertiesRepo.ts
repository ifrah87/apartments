import { randomUUID } from "crypto";
import { query } from "@/lib/db/client";
import { badRequest, notFound } from "./errors";

export type PropertyRecord = {
  id: string;
  property_id: string;
  building?: string | null;
  units?: number | null;
  name?: string | null;
};

export type PropertyInput = Partial<PropertyRecord> & { property_id?: string };

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function normalizePropertyRow(row: any): PropertyRecord {
  return {
    id: String(row.id),
    property_id: row.property_id,
    building: row.building ?? null,
    units: row.units !== null && row.units !== undefined ? Number(row.units) : null,
    name: row.name ?? row.building ?? null,
  };
}

function normalizePropertyInput(payload: PropertyInput, requireId = true) {
  const propertyId = payload.property_id?.trim();
  if (requireId && !propertyId) {
    throw badRequest("property_id is required.");
  }
  return {
    id: payload.id ? String(payload.id) : undefined,
    property_id: propertyId ?? payload.property_id,
    building: payload.building ?? payload.name ?? null,
    units: toNumber(payload.units),
    name: payload.name ?? null,
  };
}

export async function listProperties(): Promise<PropertyRecord[]> {
  const { rows } = await query(
    `SELECT id, property_id, building, units, name
     FROM properties
     ORDER BY property_id ASC`,
  );
  return rows.map(normalizePropertyRow);
}

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  if (!id) throw badRequest("Property id is required.");
  const { rows } = await query(
    `SELECT id, property_id, building, units, name
     FROM properties
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) return null;
  return normalizePropertyRow(rows[0]);
}

export async function createProperty(payload: PropertyInput): Promise<PropertyRecord> {
  const normalized = normalizePropertyInput(payload);
  const id = normalized.id ?? randomUUID();
  const { rows } = await query(
    `INSERT INTO properties (id, property_id, building, units, name)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, property_id, building, units, name`,
    [id, normalized.property_id, normalized.building, normalized.units, normalized.name],
  );
  return normalizePropertyRow(rows[0]);
}

export async function updateProperty(id: string, payload: PropertyInput): Promise<PropertyRecord> {
  if (!id) throw badRequest("Property id is required.");
  const normalized = normalizePropertyInput(payload, false);
  const fields: string[] = [];
  const params: any[] = [];

  const mapping: Array<[keyof typeof normalized, string]> = [
    ["property_id", "property_id"],
    ["building", "building"],
    ["units", "units"],
    ["name", "name"],
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
    `UPDATE properties
     SET ${fields.join(", ")}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING id, property_id, building, units, name`,
    params,
  );
  if (!rows.length) throw notFound("Property not found.");
  return normalizePropertyRow(rows[0]);
}

export async function upsertProperties(entries: PropertyInput[]) {
  let inserted = 0;
  let updated = 0;
  for (const entry of entries) {
    const normalized = normalizePropertyInput(entry, true);
    const id = normalized.id ?? randomUUID();
    const { rows } = await query<{ inserted: boolean }>(
      `INSERT INTO properties (id, property_id, building, units, name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (property_id) DO UPDATE SET
         building = EXCLUDED.building,
         units = EXCLUDED.units,
         name = EXCLUDED.name,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [id, normalized.property_id, normalized.building, normalized.units, normalized.name],
    );
    if (rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

export const propertiesRepo = {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  upsertProperties,
};
