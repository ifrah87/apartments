import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const caRaw = process.env.DATABASE_SSL_CA || "";
const caNormalized = caRaw.includes("\\n") ? caRaw.replace(/\\n/g, "\n") : caRaw;
const ca = caNormalized.trim();
const ssl =
  ca.length > 0
    ? { ca, rejectUnauthorized: true }
    : { rejectUnauthorized: true };

export const pool = new Pool({
  connectionString,
  ssl,
});

export function getPool() {
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
