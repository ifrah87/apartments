import { CUSTOM_DATASETS, type ColumnDefinition, type CustomDatasetMetadata } from "@/lib/constants/customReports";
import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import { serverFetch } from "@/lib/utils/serverFetch";

export type HydratedDataset = CustomDatasetMetadata & {
  rows: Record<string, unknown>[];
  error?: string;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeRow(row: Record<string, unknown>, columns: ColumnDefinition[]) {
  const normalized: Record<string, unknown> = { ...row };
  columns.forEach((column) => {
    const raw = row[column.key];
    if (raw === undefined) return;
    switch (column.valueType) {
      case "number":
      case "currency":
      case "percent":
        normalized[column.key] = toNumber(raw);
        break;
      default:
        normalized[column.key] = raw;
    }
  });
  return normalized;
}

export async function loadCustomReportDatasets(): Promise<HydratedDataset[]> {
  const baseUrl = getRequestBaseUrl(headers());
  const datasetPromises = CUSTOM_DATASETS.map(async (dataset) => {
    try {
      const url = `${baseUrl}${dataset.sourcePath.startsWith("/") ? dataset.sourcePath : `/${dataset.sourcePath}`}`;
      const res = await serverFetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load ${dataset.sourcePath}`);
      }
      const payload = await res.json();
      if (payload?.ok === false) throw new Error(payload.error || `Failed to load ${dataset.sourcePath}`);
      const data = (payload?.ok ? payload.data : payload) as Record<string, unknown>[];
      const rows = data.map((row) => normalizeRow(row, dataset.columns));
      return { ...dataset, rows };
    } catch (err: unknown) {
      console.error(`❌ failed to load custom dataset ${dataset.id}`, err);
      const message = err instanceof Error ? err.message : "Failed to load dataset";
      return {
        ...dataset,
        rows: [],
        error: message,
      };
    }
  });

  return Promise.all(datasetPromises);
}
