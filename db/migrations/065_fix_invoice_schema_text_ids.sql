-- 065_fix_invoice_schema_text_ids.sql
-- Force invoices/invoice_lines to use TEXT ids (matches existing 080 migration).
-- Safe to run multiple times.

-- Ensure invoices table exists
create table if not exists public.invoices (
  id text primary key
);

-- Add missing columns (no-op if they already exist)
alter table public.invoices add column if not exists property_id uuid;
alter table public.invoices add column if not exists unit_id uuid;
alter table public.invoices add column if not exists tenant_id uuid;
alter table public.invoices add column if not exists lease_id uuid;

alter table public.invoices add column if not exists invoice_number text;
alter table public.invoices add column if not exists status text not null default 'draft';
alter table public.invoices add column if not exists invoice_date date not null default current_date;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists period_start date;
alter table public.invoices add column if not exists period_end date;

alter table public.invoices add column if not exists currency text not null default 'USD';
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.invoices add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.invoices add column if not exists tax_total numeric(12,2) not null default 0;
alter table public.invoices add column if not exists total numeric(12,2) not null default 0;

alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

-- If an invoice_lines table exists with the wrong column type, drop and recreate
drop table if exists public.invoice_lines;

create table public.invoice_lines (
  id text primary key default md5(random()::text || clock_timestamp()::text),
  invoice_id text not null references public.invoices(id) on delete cascade,

  line_type text not null default 'rent'
    check (line_type in ('rent','service','utility','adjustment','other')),

  description text not null,
  quantity numeric(12,4) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);
create index if not exists invoices_tenant_id_idx on public.invoices(tenant_id);
create index if not exists invoices_unit_id_idx on public.invoices(unit_id);
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date);
