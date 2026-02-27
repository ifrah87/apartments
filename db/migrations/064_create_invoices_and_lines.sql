-- 064_create_invoices_and_lines.sql

-- IMPORTANT: keep invoices.id and invoice_lines.invoice_id the SAME TYPE for this migration.
-- We will upgrade to UUIDs in migration 065.

create table if not exists public.invoices (
  id text primary key,
  tenant_id uuid,
  unit_id uuid,
  invoice_date date not null,
  due_date date,
  status text not null default 'draft',
  currency text not null default 'USD',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id text not null,
  description text not null,
  qty numeric(12,4) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- DO NOT add FK here (we'll add it in 065 after types are fixed)
-- alter table public.invoice_lines
--   add constraint invoice_lines_invoice_id_fkey
--   foreign key (invoice_id) references public.invoices(id) on delete cascade;

create index if not exists invoices_tenant_id_idx on public.invoices(tenant_id);
create index if not exists invoices_unit_id_idx on public.invoices(unit_id);
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date);

create index if not exists invoice_lines_invoice_id_idx on public.invoice_lines(invoice_id);
