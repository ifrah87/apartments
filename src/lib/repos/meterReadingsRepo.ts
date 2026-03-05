import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { DEFAULT_INITIAL_READINGS } from "@/lib/settings/defaults";
import { normalizeSettings } from "@/lib/settings/server";
import type { InitialReadingsSettings } from "@/lib/settings/types";
import { toDateOnlyString, toPeriodKeyFromDateOnly } from "@/lib/dateOnly";
import { datasetsRepo } from "./datasetsRepo";
import { badRequest } from "./errors";
import { tenantsRepo } from "./tenantsRepo";

const METER_RATE = 0.41;
const INITIAL_READINGS_DATASET_KEY = "initial-readings";

type InitialReadingRecord = {
  unit: string;
  unit_id?: string | null;
  meter_type: string;
  reading_value: number;
  reading_date: string;
  baseline?: boolean;
  updated_at: string;
};

function toPeriodKey(value: string) {
  return toPeriodKeyFromDateOnly(value);
}

function periodBounds(period: string) {
  const [yearStr, monthStr] = period.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function resolveUnitId(unit: string, tenantId?: string | null) {
  if (tenantId) {
    const tenant = await tenantsRepo.getTenant(tenantId).catch(() => null);
    const propertyId = tenant?.property_id ?? tenant?.building ?? null;
    if (propertyId) {
      const { rows } = await query(`SELECT id FROM units WHERE property_id = $1 AND unit_number::text = $2 LIMIT 1`, [
        propertyId,
        unit,
      ]);
      if (rows[0]?.id) return String(rows[0].id);
    }
  }
  const { rows } = await query(`SELECT id FROM units WHERE unit_number::text = $1 ORDER BY created_at ASC LIMIT 1`, [
    unit,
  ]);
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function upsertInitialReadingDataset({
  unit,
  unitId,
  meterType,
  readingDate,
  readingValue,
}: {
  unit: string;
  unitId?: string | null;
  meterType: string;
  readingDate: string;
  readingValue: number;
}) {
  const entry: InitialReadingRecord = {
    unit,
    unit_id: unitId ?? null,
    meter_type: meterType,
    reading_value: readingValue,
    reading_date: toDateOnlyString(readingDate),
    baseline: true,
    updated_at: new Date().toISOString(),
  };

  await datasetsRepo.updateDataset<InitialReadingRecord[]>(
    INITIAL_READINGS_DATASET_KEY,
    (current) => {
      const rows = Array.isArray(current) ? current : [];
      const filtered = rows.filter((row) => {
        const rowType = String(row?.meter_type ?? "").toLowerCase();
        if (rowType !== meterType.toLowerCase()) return true;
        const rowUnitId = row?.unit_id !== undefined && row?.unit_id !== null ? String(row.unit_id) : "";
        const rowUnit = row?.unit !== undefined && row?.unit !== null ? String(row.unit) : "";
        if (unitId && rowUnitId) {
          return rowUnitId !== unitId;
        }
        return rowUnit !== unit;
      });
      return [...filtered, entry];
    },
    [],
  );
}

async function upsertMeterBilling({
  unit,
  tenantId,
  meterType,
  readingDate,
}: {
  unit: string;
  tenantId?: string | null;
  meterType: string;
  readingDate: string;
}) {
  const period = toPeriodKey(readingDate);
  if (!period) return;
  const bounds = periodBounds(period);
  if (!bounds) return;

  const { rows: readingRows } = await query<{ reading_date: string; reading_value: number }>(
    `SELECT reading_date, reading_value
     FROM meter_readings
     WHERE unit = $1 AND meter_type = $2 AND reading_date >= $3 AND reading_date <= $4
     ORDER BY reading_date ASC, created_at ASC`,
    [unit, meterType, bounds.start, bounds.end],
  );
  if (readingRows.length < 2) return;

  const prev = Number(readingRows[0].reading_value || 0);
  const cur = Number(readingRows[readingRows.length - 1].reading_value || 0);
  const usage = Math.max(0, Number((cur - prev).toFixed(2)));
  const amount = Number((usage * METER_RATE).toFixed(2));
  const unitId = await resolveUnitId(unit, tenantId);
  if (!unitId) return;

  await query(
    `INSERT INTO meter_billing (unit_id, meter_type, period, prev_reading, cur_reading, usage, rate, amount, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (unit_id, meter_type, period)
     DO UPDATE SET
       prev_reading = EXCLUDED.prev_reading,
       cur_reading = EXCLUDED.cur_reading,
       usage = EXCLUDED.usage,
       rate = EXCLUDED.rate,
       amount = EXCLUDED.amount,
       updated_at = now()`,
    [unitId, meterType, period, prev, cur, usage, METER_RATE, amount],
  );
}

type TenantChargeRow = {
  tenant_id: string;
  date: string;
  amount: number;
  description?: string;
  category?: string;
  property_id?: string | null;
  meter_reading_id?: string;
};

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
  baseline?: boolean;
};

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function descriptionForType(meterType: string) {
  return meterType === "water" ? "Water Billing" : "Electricity Billing";
}

function buildChargeDescription(meterType: string, usage: number) {
  const label = meterType === "water" ? "Water" : "Electricity";
  const usageLabel = Number.isFinite(usage) ? usage.toFixed(2) : "0.00";
  return `${label} usage ${usageLabel} @ ${METER_RATE}`;
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
    reading_date: toDateOnlyString(row.reading_date),
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
     ORDER BY reading_date DESC, created_at DESC
     LIMIT 1000`,
    params,
  );
  return rows.map(normalizeReadingRow);
}

export async function createReading(payload: MeterReadingInput): Promise<MeterReading> {
  const unit = payload.unit?.trim();
  const tenantId = payload.tenant_id?.trim() || null;
  const meterType = payload.meter_type?.trim();
  const readingDate = toDateOnlyString(payload.reading_date?.trim());
  const readingValue = toNumber(payload.reading_value);
  const isBaseline = payload.baseline === true;

  if (!unit) throw badRequest("Unit is required.");
  if (!meterType) throw badRequest("Meter type is required.");
  if (!readingDate) throw badRequest("Reading date is required.");
  if (readingValue === null) throw badRequest("Reading value is required.");

  let prevValue: number | undefined;
  if (isBaseline) {
    prevValue = readingValue;
  } else {
    const { rows: prevRows } = await query<{ reading_value: number }>(
      `SELECT reading_value
       FROM meter_readings
       WHERE unit = $1 AND meter_type = $2
       ORDER BY reading_date DESC, created_at DESC
       LIMIT 1`,
      [unit, meterType],
    );
    prevValue = prevRows[0]?.reading_value !== undefined ? Number(prevRows[0].reading_value) : undefined;
    if (prevValue === undefined) {
      const settings = await getInitialReadingsSettings();
      if (meterType === "water") prevValue = settings.initialReadings.water ?? 0;
      else if (meterType === "electricity") prevValue = settings.initialReadings.electricity ?? 0;
      else prevValue = 0;
    }
  }
  const usage = Number((readingValue - (prevValue ?? 0)).toFixed(2));
  const billableUsage = Math.max(usage, 0);
  const amount = Number((billableUsage * METER_RATE).toFixed(2));

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
      amount,
      payload.proof_url ?? null,
    ],
  );

  const created = rows[0];

  if (isBaseline) {
    try {
      const unitId = await resolveUnitId(unit, tenantId);
      await upsertInitialReadingDataset({
        unit,
        unitId,
        meterType,
        readingDate,
        readingValue,
      });
    } catch (err) {
      console.warn("⚠️ failed to store initial reading baseline", err);
    }
  }

  try {
    await upsertMeterBilling({ unit, tenantId, meterType, readingDate });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('relation "meter_billing" does not exist')) {
      console.warn("⚠️ failed to upsert meter billing", err);
    }
  }

  if (tenantId && amount > 0) {
    const tenant = await tenantsRepo.getTenant(tenantId);
    const propertyId = tenant?.property_id ?? tenant?.building ?? null;
    const charge: TenantChargeRow = {
      tenant_id: tenantId,
      date: readingDate,
      amount,
      description: buildChargeDescription(meterType, usage),
      category: "utilities",
      property_id: propertyId,
      meter_reading_id: created.id,
    };

    await datasetsRepo.updateDataset<TenantChargeRow[]>(
      "tenant_charges",
      (current) => {
        const rows = Array.isArray(current) ? current : [];
        if (rows.some((row) => row?.meter_reading_id === created.id)) return rows;
        return [...rows, charge];
      },
      [],
    );
  }

  return normalizeReadingRow(created);
}

export async function deleteReading(id: string): Promise<void> {
  if (!id) throw badRequest("Reading id is required.");
  await query(`DELETE FROM meter_readings WHERE id = $1`, [id]);
}

export const meterReadingsRepo = {
  listReadings,
  createReading,
  deleteReading,
};
