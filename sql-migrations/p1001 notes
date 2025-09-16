16 Sep
i had so much trouble doing the migration and then finally found it was due to not having IPv6 which is a paid add on. 
i did find a way around it which meant pushing script and migration to github

How we worked around Prisma P1001 (Supabase free tier)

Problem:
P1001: Can't reach database server when Prisma tries to use Supabase’s direct connection (db.<project>.supabase.co:5432). On the free tier this endpoint is typically IPv6-only, so many laptops/ISPs can’t reach it.

What works:
The PgBouncer pooler (aws-1-<region>.pooler.supabase.com:6543) is IPv4 and reachable. We use it for runtime and db push.

What we changed

Use pooler URL in .env

DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"


Username must include project ref: postgres.<PROJECT_REF>.
connection_limit=1 helps with PgBouncer.

IP allow-list

Get current IP: curl -4 ifconfig.me

Add it in Supabase → Settings → Database → Networking → IP Allow List

Re-add when network/VPN changes.

Avoid direct (5432) for migrations/introspection

We don’t rely on DIRECT_URL (5432) locally (this is what caused P1001).

Instead of migrate dev / db pull, we generate SQL diffs in CI.

CI workflow to generate migration SQL (no DB needed)

GitHub Action runs on changes to prisma/schema.prisma.

It executes:

npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > sql-migrations/<timestamp>.sql


(or from previous schema to current)

The SQL file is committed to sql-migrations/.

Apply SQL manually in Supabase

Copy latest sql-migrations/*.sql → Supabase SQL Editor → Run.

Then locally: npx prisma generate.

Day-to-day workflow

Edit prisma/schema.prisma.

npx prisma db push (optional; quick local check via pooler).

Commit & push → GitHub Action generates sql-migrations/<timestamp>.sql.

Paste/run that SQL in Supabase SQL Editor.

npx prisma generate (update Prisma Client).

(Optional) npx prisma studio to inspect data.

Quick troubleshooting

P1001 (again): You’re hitting 5432 (direct). Remove DIRECT_URL, stick to pooler.

Allow-list error: Add your current IP (VPN off helps).

Auth failed (P1000): Ensure username is postgres.<PROJECT_REF> and password matches Supabase DB password.

Hangs on push: Close extra DB clients, keep VPN off, ensure pooler URL has ?pgbouncer=true&connection_limit=1.

Need introspection (db pull): Run it in a cloud shell that can reach 5432, or keep designing via schema + CI SQL diffs.

Bottom line:
We bypassed the IPv4 limitation on Supabase’s direct connection by using the pooler for runtime and a Git-based SQL migration workflow (CI-generated diffs + manual apply in Supabase). This keeps us on the free tier with a reliable, versioned migration process.
