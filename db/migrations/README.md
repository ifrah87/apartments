# Canonical DB Migrations

This is the canonical migration source for this repository.

## Rules

- Add all new SQL migrations here.
- Keep filenames ordered and deterministic.
- Do not add new migrations to legacy folders outside `db/migrations`.

## Used by

- `scripts/run-migrations.ts`
- `app/api/admin/run-migrations/route.ts`
