import { randomUUID } from "crypto";
import { query } from "@/lib/db/client";
import { badRequest, notFound, type RepoError } from "./errors";

export type TenantRecord = {
  id: string;
  name: string;
  building?: string | null;
  property_id?: string | null;
  unit?: string | null;
  monthly_rent?: number | null;
  due_day?: number | null;
  reference?: string | null;
};

export type TenantFilters = {
  propertyId?: string;
  search?: string;
};

export type TenantInput = Partial<TenantRecord> & {
  name?: string;
};

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function normalizeTenantRow(row: any): TenantRecord {
  return {
    id: String(row.id),
    name: row.name,
    building: row.building ?? null,
    property_id: row.property_id ?? null,
    unit: row.unit ?? null,
    monthly_rent: row.monthly_rent !== null && row.monthly_rent !== undefined ? Number(row.monthly_rent) : null,
    due_day: row.due_day !== null && row.due_day !== undefined ? Number(row.due_day) : null,
    reference: row.reference ?? null,
  };
}

function normalizeTenantInput(payload: TenantInput, requireName = true) {
  const name = payload.name?.trim();
  if (requireName && !name) {
    throw badRequest("Tenant name is required.");
  }
  return {
    id: payload.id ? String(payload.id) : undefined,
    name: name ?? payload.name,
    building: payload.building ?? null,
    property_id: payload.property_id ?? null,
    unit: payload.unit ?? null,
    monthly_rent: toNumber(payload.monthly_rent),
    due_day: toNumber(payload.due_day),
    reference: payload.reference ?? null,
  };
}

export async function listTenants(filters: TenantFilters = {}): Promise<TenantRecord[]> {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.propertyId) {
    params.push(filters.propertyId);
    clauses.push(`(property_id = $${params.length} OR building = $${params.length})`);
  }

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    clauses.push(`LOWER(name) LIKE $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, name, building, property_id, unit, monthly_rent, due_day, reference
     FROM tenants
     ${where}
     ORDER BY name ASC`,
    params,
  );

  return rows.map(normalizeTenantRow);
}

export async function getTenant(id: string): Promise<TenantRecord | null> {
  if (!id) throw badRequest("Tenant id is required.");
  const { rows } = await query(
    `SELECT id, name, building, property_id, unit, monthly_rent, due_day, reference
     FROM tenants
     WHERE id = $1`,
    [id],
  );
  if (!rows.length) return null;
  return normalizeTenantRow(rows[0]);
}

export async function createTenant(payload: TenantInput): Promise<TenantRecord> {
  const normalized = normalizeTenantInput(payload);
  const id = normalized.id ?? randomUUID();
  const { rows } = await query(
    `INSERT INTO tenants (id, name, building, property_id, unit, monthly_rent, due_day, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, name, building, property_id, unit, monthly_rent, due_day, reference`,
    [
      id,
      normalized.name,
      normalized.building,
      normalized.property_id,
      normalized.unit,
      normalized.monthly_rent,
      normalized.due_day,
      normalized.reference,
    ],
  );
  return normalizeTenantRow(rows[0]);
}

export async function updateTenant(id: string, payload: TenantInput): Promise<TenantRecord> {
  if (!id) throw badRequest("Tenant id is required.");
  const normalized = normalizeTenantInput(payload, false);
  const fields: string[] = [];
  const params: any[] = [];

  const mapping: Array<[keyof typeof normalized, string]> = [
    ["name", "name"],
    ["building", "building"],
    ["property_id", "property_id"],
    ["unit", "unit"],
    ["monthly_rent", "monthly_rent"],
    ["due_day", "due_day"],
    ["reference", "reference"],
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
    `UPDATE tenants
     SET ${fields.join(", ")}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING id, name, building, property_id, unit, monthly_rent, due_day, reference`,
    params,
  );
  if (!rows.length) throw notFound("Tenant not found.");
  return normalizeTenantRow(rows[0]);
}

export async function deleteTenant(id: string): Promise<void> {
  if (!id) throw badRequest("Tenant id is required.");
  await query(`DELETE FROM tenants WHERE id = $1`, [id]);
}

export async function upsertTenants(entries: TenantInput[]) {
  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const normalized = normalizeTenantInput(entry, false);
    if (!normalized.id) {
      throw badRequest("Tenant id is required for import.");
    }

    const { rows } = await query<{ inserted: boolean }>(
      `INSERT INTO tenants (id, name, building, property_id, unit, monthly_rent, due_day, reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         building = EXCLUDED.building,
         property_id = EXCLUDED.property_id,
         unit = EXCLUDED.unit,
         monthly_rent = EXCLUDED.monthly_rent,
         due_day = EXCLUDED.due_day,
         reference = EXCLUDED.reference,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        normalized.id,
        normalized.name ?? "",
        normalized.building,
        normalized.property_id,
        normalized.unit,
        normalized.monthly_rent,
        normalized.due_day,
        normalized.reference,
      ],
    );

    if (rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}

export const tenantsRepo = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  upsertTenants,
};
