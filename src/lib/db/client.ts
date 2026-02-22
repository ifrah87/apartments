import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL missing");
}

const rawCa = process.env.DATABASE_CA_CERT;
if (!rawCa) {
  throw new Error("DATABASE_CA_CERT missing");
}

const ca = rawCa.replace(/\\n/g, "\n").trim();

declare global {
  // eslint-disable-next-line no-var
  var __orfane_pgPool: Pool | undefined;
}

export const pool =
  globalThis.__orfane_pgPool ??
  new Pool({
    connectionString,
    ssl: {
      require: true,
      rejectUnauthorized: true,
      ca,
    },
  });

if (!globalThis.__orfane_pgPool) {
  globalThis.__orfane_pgPool = pool;
}

export function getPool() {
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
