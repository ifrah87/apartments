import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const results: { file: string; status: "ok" | "error"; error?: string }[] = [];

    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      if (!sql.trim()) continue;
      try {
        await query(sql);
        results.push({ file, status: "ok" });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ file, status: "error", error });
      }
    }

    const errors = results.filter((r) => r.status === "error");
    return NextResponse.json({ ok: true, total: results.length, errors: errors.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run migrations";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
