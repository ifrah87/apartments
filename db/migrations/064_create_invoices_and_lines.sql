-- 064_create_invoices_and_lines.sql

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,

  invoice_number text,
  status text not null default 'draft' check (status in ('draft','issued','paid','void','overdue')),
  invoice_date date not null default current_date,
  due_date date,
  period_start date,
  period_end date,

  currency text not null default 'USD',
  notes text,
  meta jsonb not null default '{}'::jsonb,

  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure invoices has required columns even if it already existed (minimal table)
alter table public.invoices add column if not exists invoice_date date not null default current_date;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists period_start date;
alter table public.invoices add column if not exists period_end date;

alter table public.invoices add column if not exists status text not null default 'draft';
alter table public.invoices add column if not exists invoice_number text;

alter table public.invoices add column if not exists property_id uuid;
alter table public.invoices add column if not exists unit_id uuid;
alter table public.invoices add column if not exists tenant_id uuid;
alter table public.invoices add column if not exists lease_id uuid;

alter table public.invoices add column if not exists currency text not null default 'USD';
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.invoices add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.invoices add column if not exists tax_total numeric(12,2) not null default 0;
alter table public.invoices add column if not exists total numeric(12,2) not null default 0;

alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

drop index if exists invoices_tenant_id_idx;
create index if not exists invoices_tenant_id_idx on public.invoices(tenant_id);
drop index if exists invoices_unit_id_idx;
create index if not exists invoices_unit_id_idx on public.invoices(unit_id);
drop index if exists invoices_invoice_date_idx;
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,

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
