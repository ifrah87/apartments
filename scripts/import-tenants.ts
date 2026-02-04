// DEV-ONLY: one-time import / debugging script
import fs from "fs/promises";
import path from "path";
import papa from "papaparse";
import { tenantsRepo } from "@/lib/repos";

async function loadCsv(filePath?: string) {
  const preferred = filePath
    ? path.resolve(process.cwd(), filePath)
    : path.join(process.cwd(), "data", "tenants.csv");
  const fallback = path.join(process.cwd(), "data", "tenants_all_buildings_simple_unique.csv");

  try {
    return await fs.readFile(preferred, "utf8");
  } catch {
    return await fs.readFile(fallback, "utf8");
  }
}

async function run() {
  const fileArg = process.argv[2];
  const csvText = await loadCsv(fileArg);
  const parsed = papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = (parsed.data as any[])
    .filter(Boolean)
    .map((row) => ({
      id: row.id ?? row.reference,
      name: row.name,
      building: row.building,
      property_id: row.property_id,
      unit: row.unit,
      monthly_rent: row.monthly_rent,
      due_day: row.due_day,
      reference: row.reference,
    }))
    .filter((row) => row.id && row.name);

  const result = await tenantsRepo.upsertTenants(rows);
  console.log(
    `✅ Imported tenants. inserted=${result.inserted} updated=${result.updated} total=${rows.length}`,
  );
}

run().catch((err) => {
  console.error("❌ Tenant import failed:", err);
  process.exit(1);
});
