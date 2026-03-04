import fs from "fs/promises";
import path from "path";

async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = await fs.readFile(path.join(process.cwd(), file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {}
  }
}

async function run() {
  await loadEnv();
  const { query } = await import("../lib/db");

  // Delete Test Tower 2 and its units
  const { rowCount: unitRows } = await query(
    `DELETE FROM public.units WHERE property_id IN (SELECT id FROM public.properties WHERE code = 'TEST_TOWER_2')`,
  );
  const { rowCount: propRows } = await query(`DELETE FROM public.properties WHERE code = 'TEST_TOWER_2'`);
  console.log(`Deleted Test Tower 2: ${propRows ?? 0} properties, ${unitRows ?? 0} units`);

  // Remove duplicate Orfane Tower rows (keep the one with the most units)
  const { rows } = await query<{ id: string; unit_count: string }>(
    `SELECT p.id, COUNT(u.id)::text AS unit_count
     FROM public.properties p
     LEFT JOIN public.units u ON u.property_id = p.id
     WHERE lower(p.name) = 'orfane tower'
     GROUP BY p.id
     ORDER BY COUNT(u.id) DESC, p.created_at DESC`,
  );

  if (rows.length <= 1) {
    console.log("No duplicate Orfane Tower found.");
  } else {
    const [keep, ...duplicates] = rows;
    console.log(`Keeping Orfane Tower ${keep.id} (${keep.unit_count} units)`);
    const ids = duplicates.map((r) => r.id);
    const { rowCount } = await query(`DELETE FROM public.properties WHERE id = ANY($1::uuid[])`, [ids]);
    console.log(`Deleted ${rowCount ?? 0} duplicate Orfane Tower propert${(rowCount ?? 0) === 1 ? "y" : "ies"}`);
  }

  console.log("✅ Cleanup complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
