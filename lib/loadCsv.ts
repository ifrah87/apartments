import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const DATA_DIR = path.join(process.cwd(), "data");

export function readCsv(fileName: string) {
  const full = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`CSV not found: ${full}`);
  }
  const raw = fs.readFileSync(full, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

export function coerceDate(row: Record<string, any>, keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k];
    if (v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export function coerceNumber(row: Record<string, any>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v === 0 || v === "0") return 0;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      const n = Number(String(v).replace(/[,£$]/g, ""));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}
