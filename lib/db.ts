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

const poolConfig = {
  connectionString: normalizedConnectionString,
  connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 10000),
  query_timeout: Number(process.env.PGQUERY_TIMEOUT_MS || 30000),
  statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT_MS || 30000),
  idleTimeoutMillis: 30000,
  max: 2,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: !isLocalDatabase && ca ? { ca, rejectUnauthorized: true } : undefined,
};

// Singleton pool — prevents new pools being created on every hot-reload in dev,
// which would leave zombie connections in the database.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool: Pool = globalThis.__pgPool ?? new Pool(poolConfig);
if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    // Retry once on stale-connection errors (idle connection was closed by server)
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Connection terminated") || msg.includes("connection timeout") || msg.includes("ECONNRESET") || msg.includes("EPIPE")) {
      return await pool.query<T>(text, params);
    }
    throw err;
  }
}

export default query;
