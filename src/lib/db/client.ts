import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URI;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const caRaw = process.env.DATABASE_SSL_CA;
const ca = caRaw ? caRaw.replace(/\\n/g, "\n") : undefined;

export const pool = new Pool({
  connectionString,
  ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
});

export function getPool() {
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
