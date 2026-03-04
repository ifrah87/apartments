import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const normalizedConnectionString = connectionString.replace(/\?sslmode=require\b/i, "");
const hostname = (() => {
  try {
    return new URL(normalizedConnectionString).hostname;
  } catch {
    return "";
  }
})();
const isLocalDatabase = hostname === "localhost" || hostname === "127.0.0.1";

const caRaw = process.env.DATABASE_SSL_CA || "";
const ca = caRaw.includes("\\n") ? caRaw.replace(/\\n/g, "\n") : caRaw;

export const pool = new Pool({
  connectionString: normalizedConnectionString,
  connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 10000),
  query_timeout: Number(process.env.PGQUERY_TIMEOUT_MS || 30000),
  statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT_MS || 30000),
  idleTimeoutMillis: 30000,
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: !isLocalDatabase && ca
    ? {
        ca,
        rejectUnauthorized: true,
      }
    : undefined,
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
