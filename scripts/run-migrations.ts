import fs from "fs/promises";
import path from "path";

type EnvMap = Record<string, string>;

async function loadEnvFile(filename: string): Promise<EnvMap> {
  try {
    const content = await fs.readFile(filename, "utf8");
    const lines = content.split(/\r?\n/);
    const env: EnvMap = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

async function run() {
  const cwd = process.cwd();
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const filePath = path.join(cwd, file);
    const env = await loadEnvFile(filePath);
    for (const [key, value] of Object.entries(env)) {
      if (!process.env[key] && value !== undefined) {
        process.env[key] = value;
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local or export it before running.");
  }

  const { query } = await import("../lib/db");

  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows: appliedRows } = await query<{ filename: string }>(
    "SELECT filename FROM public.schema_migrations",
  );
  const applied = new Set(appliedRows.map((row) => row.filename));

  if (applied.size === 0) {
    const { rows: schemaRows } = await query<{ has_existing_schema: boolean }>(`
      SELECT (
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'properties'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'units'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'leases'
        )
      ) AS has_existing_schema
    `);

    if (schemaRows[0]?.has_existing_schema) {
      console.log("ℹ︎ Existing schema detected; baselining current migrations.");
      await query(
        `INSERT INTO public.schema_migrations (filename)
         SELECT unnest($1::text[])
         ON CONFLICT (filename) DO NOTHING`,
        [files],
      );
      files.forEach((file) => applied.add(file));
    }
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`↷ ${file} (already applied)`);
      continue;
    }
    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf8");
    if (!sql.trim()) continue;
    console.log(`▶︎ ${file}`);
    await query(sql);
    await query("INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING", [file]);
  }

  console.log("✅ Migrations complete.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
