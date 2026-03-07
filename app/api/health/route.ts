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
      "invoices",
      "bank_allocations",
      "bank_import_batches",
      "bank_reconciliation_events",
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

    const criticalColumns = [
      { table: "invoices", column: "amount_paid" },
      { table: "bank_transactions", column: "invoice_id" },
    ];
    const columnChecks = await Promise.all(
      criticalColumns.map(async (item) => {
        const { rows } = await query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2
           ) AS exists`,
          [item.table, item.column],
        );
        return { key: `${item.table}.${item.column}`, exists: Boolean(rows[0]?.exists) };
      }),
    );
    const columns = columnChecks.reduce((acc, item) => {
      acc[item.key] = item.exists;
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
              columns,
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
      { status: 503 },
    );
  }
}
