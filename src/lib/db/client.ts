import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __orfane_pgPool: Pool | undefined;
}

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (configure it in Vercel Environment Variables).");
  }

  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  const ssl = ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };

  if (!globalThis.__orfane_pgPool) {
    globalThis.__orfane_pgPool = new Pool({
      connectionString,
      ssl,
    });
  }

  return globalThis.__orfane_pgPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export default query;
