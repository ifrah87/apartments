import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const caRaw = process.env.DATABASE_SSL_CA || "";
const ca = caRaw.includes("\\n") ? caRaw.replace(/\\n/g, "\n") : caRaw;

export const pool = new Pool({
  connectionString,
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
