import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const start = Date.now();
  const isProduction = process.env.NODE_ENV === "production";
  const env = { hasDatabaseUrl: Boolean(process.env.DATABASE_URL) };

  try {
    await query("SELECT 1");
    const latencyMs = Date.now() - start;

    const tableNames = [
      "tenants",
      "units",
      "properties",
      "bank_transactions",
      "meter_readings",
    ];

    const tableChecks = await Promise.all(
      tableNames.map(async (name) => {
        const { rows } = await query<{ exists: string | null }>(
          "SELECT to_regclass($1) as exists",
          [`public.${name}`],
        );
        return { name, exists: Boolean(rows[0]?.exists) };
      }),
    );

    const tables = tableChecks.reduce((acc, item) => {
      acc[item.name] = item.exists;
      return acc;
    }, {} as Record<string, boolean>);

    return NextResponse.json(
      isProduction
        ? {
            ok: true,
            data: {
              db: { connected: true, latencyMs },
              timestamp: new Date().toISOString(),
            },
          }
        : {
            ok: true,
            data: {
              db: { connected: true, latencyMs },
              tables,
              env,
              timestamp: new Date().toISOString(),
            },
          },
    );
  } catch {
    return NextResponse.json(
      isProduction
        ? {
            ok: false,
            error: "Service unavailable",
            data: {
              db: { connected: false },
              timestamp: new Date().toISOString(),
            },
          }
        : {
            ok: false,
            error: "Database connection failed",
            data: {
              db: { connected: false },
              env,
              timestamp: new Date().toISOString(),
            },
          },
      { status: 500 },
    );
  }
}
