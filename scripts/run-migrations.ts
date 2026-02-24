import fs from "fs/promises";
import path from "path";
import { query } from "../lib/db";

async function run() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf8");
    if (!sql.trim()) continue;
    console.log(`▶︎ ${file}`);
    await query(sql);
  }

  console.log("✅ Migrations complete.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
