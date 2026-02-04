import { Pool, type QueryResult } from "pg";

const globalForPg = globalThis as unknown as { __PG_POOL__?: Pool };

const connectionString = process.env.DATABASE_URL;

export const pool: Pool =
  globalForPg.__PG_POOL__ ??
  new Pool(
    connectionString
      ? { connectionString }
      : {
          host: "127.0.0.1",
          port: 5432,
          database: "apartments",
          user: "postgres",
        },
  );

if (!globalForPg.__PG_POOL__) globalForPg.__PG_POOL__ = pool;

export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default query;
