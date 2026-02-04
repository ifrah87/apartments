import { query } from "@/lib/db/client";
import { badRequest } from "./errors";

export type DatasetKey = string;

function normalizeKey(key: string) {
  const cleaned = key.trim();
  if (!cleaned) throw badRequest("Dataset key is required.");
  return cleaned;
}

async function ensureDatasetsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS app_datasets (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
}

export async function getDataset<T>(key: DatasetKey, fallback: T): Promise<T> {
  const normalized = normalizeKey(key);
  try {
    const { rows } = await query<{ data: T }>(
      "SELECT data FROM app_datasets WHERE key = $1",
      [normalized],
    );
    if (!rows.length) return fallback;
    return rows[0].data ?? fallback;
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "app_datasets" does not exist')) {
      console.warn("⚠️ app_datasets table missing; returning fallback dataset.");
      return fallback;
    }
    throw err;
  }
}

export async function setDataset<T>(key: DatasetKey, data: T): Promise<T> {
  const normalized = normalizeKey(key);
  try {
    await query(
      `INSERT INTO app_datasets (key, data)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [normalized, data],
    );
  } catch (err: any) {
    const code = err?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "42P01" || message.includes('relation "app_datasets" does not exist')) {
      await ensureDatasetsTable();
      await query(
        `INSERT INTO app_datasets (key, data)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [normalized, data],
      );
    } else {
      throw err;
    }
  }
  return data;
}

export async function updateDataset<T>(key: DatasetKey, updater: (current: T) => T, fallback: T): Promise<T> {
  const current = await getDataset<T>(key, fallback);
  const next = updater(current);
  await setDataset<T>(key, next);
  return next;
}

export const datasetsRepo = {
  getDataset,
  setDataset,
  updateDataset,
};
