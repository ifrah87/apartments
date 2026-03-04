begin;

create extension if not exists pgcrypto;

-- Drop FK if it exists
alter table if exists public.invoice_lines
  drop constraint if exists invoice_lines_invoice_id_fkey;

-- If invoices.id is text, upgrade it to uuid while preserving old id in legacy_id
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='invoices' and column_name='id' and data_type='text'
  ) then
    alter table public.invoices add column if not exists legacy_id text;
    update public.invoices set legacy_id = id where legacy_id is null;

    alter table public.invoices add column if not exists id_uuid uuid;

    -- If old ids look like uuids, cast; otherwise generate
    update public.invoices
      set id_uuid = nullif(id,'')::uuid
    where id_uuid is null
      and id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    update public.invoices
      set id_uuid = gen_random_uuid()
    where id_uuid is null;

    alter table public.invoices drop constraint if exists invoices_pkey;
    alter table public.invoices drop column id;
    alter table public.invoices rename column id_uuid to id;
    alter table public.invoices add primary key (id);
  end if;
end $$;

-- Upgrade invoice_lines.invoice_id (text) -> uuid using mapping to invoices.legacy_id
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='invoice_lines' and column_name='invoice_id' and data_type='text'
  ) then
    alter table public.invoice_lines add column if not exists invoice_id_uuid uuid;

    -- Map old invoice_id (text) to the new invoices.id (uuid) via invoices.legacy_id
    update public.invoice_lines il
      set invoice_id_uuid = i.id
    from public.invoices i
    where il.invoice_id_uuid is null
      and il.invoice_id = i.legacy_id;

    -- For any rows that still didn't map, try direct cast if it looks like a uuid
    update public.invoice_lines
      set invoice_id_uuid = nullif(invoice_id,'')::uuid
    where invoice_id_uuid is null
      and invoice_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- If still null, leave null check will fail later (good: forces cleanup)
    alter table public.invoice_lines alter column invoice_id_uuid set not null;

    alter table public.invoice_lines drop column invoice_id;
    alter table public.invoice_lines rename column invoice_id_uuid to invoice_id;
  end if;
end $$;

-- Now the FK will work (uuid -> uuid)
do $$
begin
  if to_regclass('public.invoices') is null or to_regclass('public.invoice_lines') is null then
    return;
  end if;

  alter table public.invoice_lines
    add constraint invoice_lines_invoice_id_fkey
    foreign key (invoice_id) references public.invoices(id)
    on delete cascade;
end $$;

commit;
