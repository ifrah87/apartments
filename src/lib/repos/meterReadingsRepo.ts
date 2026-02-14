import { randomUUID } from "crypto";
import { query } from "@/lib/db/client";
import { DEFAULT_INITIAL_READINGS } from "@/lib/settings/defaults";
import { normalizeSettings } from "@/lib/settings/server";
import type { InitialReadingsSettings } from "@/lib/settings/types";
import { datasetsRepo } from "./datasetsRepo";
import { badRequest } from "./errors";

export type MeterReading = {
  id: string;
  unit: string;
  tenant_id?: string | null;
  meter_type: "water" | "electricity" | string;
  reading_date: string;
  reading_value: number;
  prev_value: number;
  usage: number;
  amount: number;
  proof_url?: string | null;
  description?: string;
};

export type MeterReadingFilters = {
  unit?: string;
  meterType?: string;
};

export type MeterReadingInput = {
  unit?: string;
  tenant_id?: string | null;
  meter_type?: string;
  reading_date?: string;
  reading_value?: number | string;
  proof_url?: string | null;
};

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function descriptionForType(meterType: string) {
  return meterType === "water" ? "Water Billing" : "Electricity Billing";
}

async function getInitialReadingsSettings(): Promise<InitialReadingsSettings> {
  const raw = await datasetsRepo.getDataset("settings.initialReadings", DEFAULT_INITIAL_READINGS);
  const normalized = normalizeSettings("initial-readings", raw, false);
  return normalized.value as InitialReadingsSettings;
}

function normalizeReadingRow(row: any): MeterReading {
  return {
    id: String(row.id),
    unit: row.unit,
    tenant_id: row.tenant_id ?? null,
    meter_type: row.meter_type,
    reading_date: row.reading_date,
    reading_value: row.reading_value !== null && row.reading_value !== undefined ? Number(row.reading_value) : 0,
    prev_value: row.prev_value !== null && row.prev_value !== undefined ? Number(row.prev_value) : 0,
    usage: row.usage !== null && row.usage !== undefined ? Number(row.usage) : 0,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
    proof_url: row.proof_url ?? null,
    description: descriptionForType(row.meter_type),
  };
}

export async function listReadings(filters: MeterReadingFilters = {}): Promise<MeterReading[]> {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.unit) {
    params.push(filters.unit);
    clauses.push(`unit = $${params.length}`);
  }
  if (filters.meterType) {
    params.push(filters.meterType);
    clauses.push(`meter_type = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, unit, tenant_id, meter_type, reading_date, reading_value, prev_value, usage, amount, proof_url
     FROM meter_readings
     ${where}
     ORDER BY reading_date DESC, created_at DESC`,
    params,
  );
  return rows.map(normalizeReadingRow);
}

export async function createReading(payload: MeterReadingInput): Promise<MeterReading> {
  const unit = payload.unit?.trim();
  const tenantId = payload.tenant_id?.trim() || null;
  const meterType = payload.meter_type?.trim();
  const readingDate = payload.reading_date?.trim();
  const readingValue = toNumber(payload.reading_value);

  if (!unit) throw badRequest("Unit is required.");
  if (!meterType) throw badRequest("Meter type is required.");
  if (!readingDate) throw badRequest("Reading date is required.");
  if (readingValue === null) throw badRequest("Reading value is required.");

  const { rows: prevRows } = await query<{ reading_value: number }>(
    `SELECT reading_value
     FROM meter_readings
     WHERE unit = $1 AND meter_type = $2
     ORDER BY reading_date DESC, created_at DESC
     LIMIT 1`,
    [unit, meterType],
  );
  let prevValue = prevRows[0]?.reading_value !== undefined ? Number(prevRows[0].reading_value) : undefined;
  if (prevValue === undefined) {
    const settings = await getInitialReadingsSettings();
    if (meterType === "water") prevValue = settings.initialReadings.water ?? 0;
    else if (meterType === "electricity") prevValue = settings.initialReadings.electricity ?? 0;
    else prevValue = 0;
  }
  const usage = Number((readingValue - prevValue).toFixed(2));

  const { rows } = await query(
    `INSERT INTO meter_readings (id, unit, tenant_id, meter_type, reading_date, reading_value, prev_value, usage, amount, proof_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, unit, tenant_id, meter_type, reading_date, reading_value, prev_value, usage, amount, proof_url`,
    [
      randomUUID(),
      unit,
      tenantId,
      meterType,
      readingDate,
      readingValue,
      prevValue,
      usage,
      0,
      payload.proof_url ?? null,
    ],
  );

  return normalizeReadingRow(rows[0]);
}

export const meterReadingsRepo = {
  listReadings,
  createReading,
};
