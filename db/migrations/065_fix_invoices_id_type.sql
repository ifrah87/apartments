-- 065_fix_invoices_id_type.sql
-- Fix type mismatch: public.invoices.id is text, but invoice_lines.invoice_id expects uuid.

begin;

-- Safety: ensure pgcrypto exists for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) If invoice_lines table exists, temporarily drop the FK (if it was partially created elsewhere)
alter table if exists public.invoice_lines
  drop constraint if exists invoice_lines_invoice_id_fkey;

-- 2) Convert invoices.id to uuid safely:
-- If invoices.id currently contains UUID-looking strings, we can cast.
-- If not, we generate new UUIDs and keep old id in legacy_id.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='invoices' and column_name='id' and data_type='text'
  ) then

    -- Keep the old text id
    alter table public.invoices add column if not exists legacy_id text;

    -- Copy id -> legacy_id where empty
    update public.invoices
      set legacy_id = id
    where legacy_id is null;

    -- Add new uuid column
    alter table public.invoices add column if not exists id_uuid uuid;

    -- Try to cast text ids that are valid UUIDs
    update public.invoices
      set id_uuid = nullif(id,'')::uuid
    where id_uuid is null
      and id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- For any remaining rows, generate new UUID
    update public.invoices
      set id_uuid = gen_random_uuid()
    where id_uuid is null;

    -- Drop old PK if any
    alter table public.invoices drop constraint if exists invoices_pkey;

    -- Swap columns: drop old id, rename id_uuid -> id
    alter table public.invoices drop column id;
    alter table public.invoices rename column id_uuid to id;

    -- Recreate PK
    alter table public.invoices add primary key (id);

  end if;
end $$;

-- 3) Make sure invoice_lines.invoice_id is uuid (and convert if it was text)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='invoice_lines' and column_name='invoice_id' and data_type='text'
  ) then
    -- Convert invoice_id text -> uuid where possible
    alter table public.invoice_lines
      alter column invoice_id type uuid
      using nullif(invoice_id,'')::uuid;
  end if;
end $$;

-- 4) Recreate FK (now both sides uuid)
alter table if exists public.invoice_lines
  add constraint invoice_lines_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id)
  on delete cascade;

commit;
