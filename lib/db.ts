// lib/db.ts
import { Pool, type QueryResult } from 'pg';

const g = global as any;

// Prefer .env DATABASE_URL; fallback to local defaults
const connectionString = process.env.DATABASE_URL;

export const pool: Pool =
  g.__PG_POOL__ ??
  new Pool(
    connectionString
      ? { connectionString } // e.g. postgresql://postgres@127.0.0.1:5432/apartments
      : {
          host: '127.0.0.1',
          port: 5432,
          database: 'apartments',
          user: 'postgres',
          // password: '', // only if you actually set one
        }
  );

if (!g.__PG_POOL__) g.__PG_POOL__ = pool;

export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

// Optional default export so default imports also work
export default query;
