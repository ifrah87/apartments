-- Move invoice drafts to Postgres so billing flows are DB-first.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.invoice_drafts (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_drafts_tenant_period_uidx
  ON public.invoice_drafts (tenant_id, period);
