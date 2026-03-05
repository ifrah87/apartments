import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { datasetsRepo } from "@/lib/repos/datasetsRepo";
import type { LeaseAgreement } from "@/lib/leases";
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

export type PropertySummary = {
  id: string;
  name: string;
  code: string | null;
  status: "active" | "archived";
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  monthlyRent: number;
};

type PropertiesSchema = {
  hasCode: boolean;
  hasStatus: boolean;
  hasAddress: boolean;
  hasCity: boolean;
  hasCountry: boolean;
  hasLegacyPropertyId: boolean;
  hasLegacyBuilding: boolean;
  hasLegacyUnits: boolean;
};

// Shared promise — all concurrent callers await the same single query
let _propertiesSchemaPromise: Promise<PropertiesSchema> | null = null;

async function getPropertiesSchema(): Promise<PropertiesSchema> {
  if (!_propertiesSchemaPromise) {
    _propertiesSchemaPromise = (async () => {
      // pg_catalog is far faster than information_schema.columns
      const { rows } = await query<{ column_name: string }>(
        `SELECT a.attname AS column_name
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'properties'
           AND a.attnum > 0 AND NOT a.attisdropped`,
      );
      const columns = new Set(rows.map((r) => r.column_name));
      return {
        hasCode: columns.has("code"),
        hasStatus: columns.has("status"),
        hasAddress: columns.has("address"),
        hasCity: columns.has("city"),
        hasCountry: columns.has("country"),
        hasLegacyPropertyId: columns.has("property_id"),
        hasLegacyBuilding: columns.has("building"),
        hasLegacyUnits: columns.has("units"),
      };
    })().catch((err) => {
      _propertiesSchemaPromise = null; // allow retry on failure
      throw err;
    });
  }
  return _propertiesSchemaPromise;
}

function legacyNameExpr(schema: PropertiesSchema, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const parts = [
    `NULLIF(${prefix}name, '')`,
    schema.hasLegacyBuilding ? `NULLIF(${prefix}building, '')` : "NULL",
    schema.hasLegacyPropertyId ? `NULLIF(${prefix}property_id, '')` : "NULL",
    `${prefix}id::text`,
  ];
  return `COALESCE(${parts.join(", ")})`;
}

function legacyPropertyKeyExpr(schema: PropertiesSchema, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  if (schema.hasLegacyPropertyId) {
    return `COALESCE(NULLIF(${prefix}property_id, ''), ${prefix}id::text)`;
  }
  return `${prefix}id::text`;
}

function generateLegacyPropertyKey(name: string, code?: string | null) {
  const value = (code || name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return value || randomUUID();
}

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
  const schema = await getPropertiesSchema();
  const rows = schema.hasCode && schema.hasStatus
    ? (
        await query(
          `SELECT id, name, code, status
           FROM properties
           ${includeArchived ? "" : "WHERE status <> 'archived'"}
           ORDER BY created_at DESC`,
        )
      ).rows
    : (
        await query(
          `SELECT
             id::text as id,
             ${legacyNameExpr(schema)} as name,
             NULL::text as code,
             'active'::text as status,
             created_at
           FROM properties
           ORDER BY created_at DESC`,
        )
      ).rows;
  return rows.map(normalizePropertyRow);
}

export async function listPropertySummaries(): Promise<PropertySummary[]> {
  const schema = await getPropertiesSchema();
  const { rows } = schema.hasCode && schema.hasStatus
    ? await query(
        `SELECT
           p.id,
           p.name,
           p.code,
           p.status,
           COALESCE(u.total_units, 0)::int as total_units,
           COALESCE(u.occupied_units, 0)::int as occupied_units,
           COALESCE(u.vacant_units, 0)::int as vacant_units
         FROM properties p
         LEFT JOIN (
           SELECT
             property_id,
             COUNT(*) as total_units,
             COUNT(*) FILTER (WHERE lower(status) = 'occupied') as occupied_units,
             COUNT(*) FILTER (WHERE lower(status) = 'vacant') as vacant_units
           FROM units
            GROUP BY property_id
         ) u ON u.property_id = p.id
         WHERE p.status <> 'archived'
         ORDER BY p.created_at DESC`,
      )
    : await query(
        `SELECT
           p.id::text as id,
           ${legacyNameExpr(schema, "p")} as name,
           NULL::text as code,
           'active'::text as status,
           COALESCE(u.total_units, ${schema.hasLegacyUnits ? "COALESCE(p.units, 0)" : "0"})::int as total_units,
           COALESCE(u.occupied_units, 0)::int as occupied_units,
           GREATEST(COALESCE(u.total_units, ${schema.hasLegacyUnits ? "COALESCE(p.units, 0)" : "0"}) - COALESCE(u.occupied_units, 0), 0)::int as vacant_units
         FROM properties p
         LEFT JOIN (
           SELECT
             property_id::text as property_id,
             COUNT(*)::int as total_units,
             COUNT(*) FILTER (WHERE lower(status) = 'occupied')::int as occupied_units
           FROM units
           GROUP BY property_id
         ) u ON u.property_id = ${legacyPropertyKeyExpr(schema, "p")}
         ORDER BY p.created_at DESC`,
      );

  const leases = await datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []);
  const leaseList = Array.isArray(leases) ? leases : [];

  const propertyKeyMap = new Map<string, string>();
  rows.forEach((row: any) => {
    const id = String(row.id).toLowerCase();
    const name = String(row.name || "").toLowerCase();
    const code = String(row.code || "").toLowerCase();
    if (id) propertyKeyMap.set(id, String(row.id));
    if (name) propertyKeyMap.set(name, String(row.id));
    if (code) propertyKeyMap.set(code, String(row.id));
  });

  const rentByProperty = new Map<string, number>();
  leaseList.forEach((lease) => {
    if (!lease || typeof lease !== "object") return;
    if ((lease.status || "").toLowerCase() !== "active") return;
    const key = String(lease.property || "").toLowerCase();
    if (!key) return;
    const propertyId = propertyKeyMap.get(key);
    if (!propertyId) return;
    const rent = Number(lease.rent || 0);
    if (!Number.isFinite(rent) || rent <= 0) return;
    rentByProperty.set(propertyId, (rentByProperty.get(propertyId) || 0) + rent);
  });

  return rows.map((row: any) => {
    const id = String(row.id);
    return {
      id,
      name: String(row.name),
      code: row.code ?? null,
      status: row.status === "archived" ? "archived" : "active",
      totalUnits: Number(row.total_units || 0),
      occupiedUnits: Number(row.occupied_units || 0),
      vacantUnits: Number(row.vacant_units || 0),
      monthlyRent: Number(rentByProperty.get(id) || 0),
    };
  });
}

export async function getProperty(id: string): Promise<PropertyRecord | null> {
  if (!id) throw badRequest("Property id is required.");
  const schema = await getPropertiesSchema();
  const { rows } = schema.hasCode && schema.hasStatus
    ? await query(
        `SELECT id, name, code, address, city, country, status, created_at
         FROM properties
         WHERE id = $1`,
        [id],
      )
    : await query(
        `SELECT
           id::text as id,
           ${legacyNameExpr(schema)} as name,
           NULL::text as code,
           NULL::text as address,
           NULL::text as city,
           NULL::text as country,
           'active'::text as status,
           created_at
         FROM properties
         WHERE id = $1
           ${schema.hasLegacyPropertyId ? "OR property_id = $1" : ""}`,
        [id],
      );
  if (!rows.length) return null;
  return normalizePropertyRow(rows[0]);
}

export async function createProperty(payload: PropertyInput): Promise<PropertyRecord> {
  const normalized = normalizePropertyInput(payload);
  const schema = await getPropertiesSchema();
  const { rows } = schema.hasCode && schema.hasStatus
    ? await query(
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
      )
    : await query(
        `INSERT INTO properties (id, property_id, building, units, name, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,now(),now())
         RETURNING
           id::text as id,
           ${legacyNameExpr(schema)} as name,
           NULL::text as code,
           NULL::text as address,
           NULL::text as city,
           NULL::text as country,
           'active'::text as status,
           created_at`,
        [
          generateLegacyPropertyKey(normalized.name, normalized.code),
          generateLegacyPropertyKey(normalized.name, normalized.code),
          normalized.name,
          0,
          normalized.name,
        ],
      );
  return normalizePropertyRow(rows[0]);
}

export async function updateProperty(id: string, payload: PropertyInput): Promise<PropertyRecord> {
  if (!id) throw badRequest("Property id is required.");
  const schema = await getPropertiesSchema();

  if (!(schema.hasCode && schema.hasStatus)) {
    const fields: string[] = [];
    const params: any[] = [];

    if (payload.name !== undefined) {
      const name = String(payload.name || "").trim();
      if (!name) throw badRequest("name is required.");
      params.push(name);
      fields.push(`name = $${params.length}`);
      if (schema.hasLegacyBuilding) {
        params.push(name);
        fields.push(`building = $${params.length}`);
      }
    }

    if (payload.code !== undefined && schema.hasLegacyPropertyId) {
      const propertyKey = generateLegacyPropertyKey(String(payload.name || ""), String(payload.code || ""));
      params.push(propertyKey);
      fields.push(`property_id = $${params.length}`);
    }

    if (!fields.length) {
      throw badRequest("No fields provided to update.");
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE properties
       SET ${fields.join(", ")}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING
         id::text as id,
         ${legacyNameExpr(schema)} as name,
         NULL::text as code,
         NULL::text as address,
         NULL::text as city,
         NULL::text as country,
         'active'::text as status,
         created_at`,
      params,
    );
    if (!rows.length) throw notFound("Property not found.");
    return normalizePropertyRow(rows[0]);
  }

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
  listPropertySummaries,
  getProperty,
  createProperty,
  updateProperty,
};
