import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

const rawCa = process.env.DATABASE_CA_CERT;
if (!rawCa) throw new Error("DATABASE_CA_CERT missing");

// Vercel sometimes stores multiline certs with literal \n
const ca = rawCa.replace(/\\n/g, "\n").trim();

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca,
  },
});

export function getPool() {
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
