import { Pool, type QueryResult } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __orfane_pgPool: Pool | undefined;
}

function getSslConfig() {
  const caRaw = process.env.DATABASE_SSL_CA;
  if (!caRaw) return undefined;

  const ca = caRaw.replace(/\\n/g, "\n");

  return {
    ca,
    rejectUnauthorized: true,
  } as const;
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!globalThis.__orfane_pgPool) {
    globalThis.__orfane_pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
    });
  }

  return globalThis.__orfane_pgPool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export default query;
