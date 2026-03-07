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
  query_timeout: Number(process.env.PGQUERY_TIMEOUT_MS || 20000),
  statement_timeout: Number(process.env.PGSTATEMENT_TIMEOUT_MS || 20000),
  idleTimeoutMillis: 30000,
  max: Number(process.env.PGPOOL_MAX || 10),
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

let schemaReady = false;
let schemaBootstrapPromise: Promise<void> | null = null;
let schemaBootstrapLastAttempt = 0;
let transientFailureCount = 0;
let circuitOpenUntilMs = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConnectionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("ECONNRESET") ||
    message.includes("EPIPE") ||
    message.includes("ETIMEDOUT") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("Connection terminated due to connection timeout") ||
    message === "Connection terminated unexpectedly" ||
    message.includes("Connection terminated unexpectedly")
  );
}

function isSchemaDriftError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code === "42703" || code === "42P01";
}

async function ensureOperationalColumns() {
  // Best-effort schema safety net for live operations.
  await pool.query(`ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await pool.query(`ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS voided_at timestamptz`);
  await pool.query(`ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS lease_id text`);
  await pool.query(`ALTER TABLE IF EXISTS public.bank_transactions ADD COLUMN IF NOT EXISTS invoice_id text`);
  await pool.query(`ALTER TABLE IF EXISTS public.bank_transactions ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE IF EXISTS public.bank_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await pool.query(`ALTER TABLE IF EXISTS public.leases ADD COLUMN IF NOT EXISTS external_id text`);
  await pool.query(`ALTER TABLE IF EXISTS public.leases ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE IF EXISTS public.leases ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS leases_external_id_uidx ON public.leases(external_id) WHERE external_id IS NOT NULL`);
  await pool.query(`DROP INDEX IF EXISTS public.uq_leases_one_active_per_unit`);
  await pool.query(`DROP INDEX IF EXISTS public.uniq_active_lease_per_unit`);
  await pool.query(`ALTER TABLE IF EXISTS public.tenants ADD COLUMN IF NOT EXISTS phone text`);
  await pool.query(`ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await pool.query(`ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS invoice_id text`);
  await pool.query(`ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS tenant_id uuid`);
  await pool.query(`ALTER TABLE IF EXISTS public.payments ADD COLUMN IF NOT EXISTS bank_transaction_id uuid`);
  await pool.query(`ALTER TABLE IF EXISTS public.lease_charges ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE IF EXISTS public.lease_charges ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS public.invoice_drafts (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      period text NOT NULL,
      line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes text,
      invoice_number text,
      issue_date date,
      due_date date,
      reference text,
      currency text,
      is_deleted boolean NOT NULL DEFAULT false,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS invoice_drafts_tenant_period_uidx
       ON public.invoice_drafts(tenant_id, period)`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS public.deposit_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id text,
      lease_id text,
      invoice_id text,
      tx_date date NOT NULL,
      tx_type text NOT NULL,
      amount numeric(12,2) NOT NULL CHECK (amount > 0),
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS lease_charges_active_lease_idx
       ON public.lease_charges(lease_id)
       WHERE COALESCE(is_deleted, false) = false`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS deposit_transactions_invoice_idx
       ON public.deposit_transactions(invoice_id, created_at DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS deposit_transactions_lease_idx
       ON public.deposit_transactions(lease_id, created_at DESC)`,
  );
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS unique_active_lease_per_unit ON public.leases(unit_id) WHERE status = 'active' AND COALESCE(is_deleted, false) = false`);
}

async function ensureOperationalColumnsOnce(force = false) {
  if (schemaReady && !force) return;
  const now = Date.now();
  if (!force && now - schemaBootstrapLastAttempt < 30_000) return;
  if (schemaBootstrapPromise) {
    await schemaBootstrapPromise;
    return;
  }

  schemaBootstrapLastAttempt = now;
  schemaBootstrapPromise = (async () => {
    try {
      await ensureOperationalColumns();
      schemaReady = true;
    } catch (err) {
      // Keep app running even if bootstrap can't run right now (e.g. DB network outage).
      if (process.env.NODE_ENV !== "production") {
        console.warn("DB schema bootstrap skipped:", err instanceof Error ? err.message : String(err));
      }
    } finally {
      schemaBootstrapPromise = null;
    }
  })();

  await schemaBootstrapPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const isProduction = process.env.NODE_ENV === "production";
  const now = Date.now();
  if (circuitOpenUntilMs > now) {
    throw new Error("Database temporarily unavailable (connection circuit open)");
  }

  const maxAttempts = 2;
  const backoffMs = [200];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await pool.query<T>(text, params);
      // Run schema safety net lazily only in non-production environments.
      if (!isProduction) {
        void ensureOperationalColumnsOnce(false);
      }
      transientFailureCount = 0;
      circuitOpenUntilMs = 0;
      return result;
    } catch (err) {
      // Auto-heal known schema drift once in non-production, then retry immediately.
      if (!isProduction && isSchemaDriftError(err)) {
        await ensureOperationalColumnsOnce(true);
        if (attempt < maxAttempts) continue;
      }

      // Retry transient network/connection errors with short backoff.
      if (isTransientConnectionError(err) && attempt < maxAttempts) {
        await sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
        continue;
      }

      if (isTransientConnectionError(err)) {
        transientFailureCount += 1;
        if (transientFailureCount >= 3) {
          // Avoid request pile-ups when network/DB is flaky.
          circuitOpenUntilMs = Date.now() + 15_000;
        }
      }

      throw err;
    }
  }

  throw new Error("Database query failed after retries");
}

export default query;
