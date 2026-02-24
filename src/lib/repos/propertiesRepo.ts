import { query } from "@/lib/db";
import { badRequest, notFound } from "./errors";

export type PropertyRecord = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status: "active" | "archived";
  created_at?: string | null;
};

export type PropertyInput = Partial<PropertyRecord> & { name?: string };

function normalizePropertyRow(row: any): PropertyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    code: row.code ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    status: row.status === "archived" ? "archived" : "active",
    created_at: row.created_at ?? null,
  };
}

function normalizePropertyInput(payload: PropertyInput) {
  const name = payload.name?.trim();
  if (!name) throw badRequest("name is required.");
  return {
    name,
    code: payload.code ? String(payload.code).trim() : null,
    address: payload.address ? String(payload.address).trim() : null,
    city: payload.city ? String(payload.city).trim() : null,
    country: payload.country ? String(payload.country).trim() : null,
    status: payload.status === "archived" ? "archived" : "active",
  };
}

export async function listProperties(includeArchived = true): Promise<PropertyRecord[]> {
  const where = includeArchived ? "" : "WHERE status <> 'archived'";
  const { rows } = await query(
    `SELECT id, name, code, status
     FROM properties
     ${where}
     ORDER BY created_at DESC`,
  );
  return rows.map(normalizePropertyRow);
}

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  if (!id) throw badRequest("Property id is required.");
  const { rows } = await query(
    `SELECT id, name, code, address, city, country, status, created_at
     FROM properties
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) return null;
  return normalizePropertyRow(rows[0]);
}

export async function createProperty(payload: PropertyInput): Promise<PropertyRecord> {
  const normalized = normalizePropertyInput(payload);
  const { rows } = await query(
    `INSERT INTO properties (name, code, address, city, country, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, code, address, city, country, status, created_at`,
    [
      normalized.name,
      normalized.code,
      normalized.address,
      normalized.city,
      normalized.country,
      normalized.status,
    ],
  );
  return normalizePropertyRow(rows[0]);
}

export async function updateProperty(id: string, payload: PropertyInput): Promise<PropertyRecord> {
  if (!id) throw badRequest("Property id is required.");
  const fields: string[] = [];
  const params: any[] = [];

  const mapping: Array<[keyof PropertyRecord, string, any]> = [
    ["name", "name", payload.name ? String(payload.name).trim() : undefined],
    ["code", "code", payload.code ? String(payload.code).trim() : undefined],
    ["address", "address", payload.address ? String(payload.address).trim() : undefined],
    ["city", "city", payload.city ? String(payload.city).trim() : undefined],
    ["country", "country", payload.country ? String(payload.country).trim() : undefined],
    ["status", "status", payload.status === "archived" ? "archived" : payload.status ? "active" : undefined],
  ];

  mapping.forEach(([, column, value]) => {
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
     SET ${fields.join(", ")}, created_at = created_at
     WHERE id = $${params.length}
     RETURNING id, name, code, address, city, country, status, created_at`,
    params,
  );
  if (!rows.length) throw notFound("Property not found.");
  return normalizePropertyRow(rows[0]);
}

export const propertiesRepo = {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
};
