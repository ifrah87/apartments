Prisma P1001 Workaround (Supabase Free Tier)

Issue (16 Sep):
Prisma migration failed with:

P1001: Can't reach database server


Supabase free tier only provides direct connections (5432) over IPv6, which isn’t supported everywhere (and is a paid add-on).

✅ Workaround

Use PgBouncer pooler (IPv4)
In .env:

DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"


Username must include project ref (postgres.<PROJECT_REF>).

connection_limit=1 is required for PgBouncer.

Allow-list IP

curl -4 ifconfig.me


Add your IP in Supabase → Database → Networking → IP Allow List.
Re-add if your IP changes (VPN, new network).

Skip direct introspection (5432)
We don’t use DIRECT_URL. Instead, migrations are generated in CI.

GitHub Action for migrations
On changes to schema.prisma, CI runs:

npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > sql-migrations/<timestamp>.sql


→ SQL is committed into sql-migrations/.

Apply manually in Supabase
Copy latest SQL file → paste into Supabase SQL Editor → Run.
Then locally:

npx prisma generate

🔄 Workflow Summary

Edit prisma/schema.prisma.

(Optional) npx prisma db push locally with pooler.

Commit & push → GitHub Action generates .sql.

Apply SQL in Supabase SQL Editor.

Run npx prisma generate locally.

Use npx prisma studio to browse data.

Bottom line:
We bypassed the P1001 error by avoiding direct IPv6 connections and moving migrations to GitHub Actions + manual SQL in Supabase. This keeps everything working on the free tier.
