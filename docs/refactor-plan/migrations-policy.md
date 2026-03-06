# Migration Folder Policy

Canonical migration folder: `db/migrations`.

## Policy

- All new SQL migrations must be added to `db/migrations`.
- Runtime migration scripts and admin migration endpoints must read from `db/migrations`.
- Other migration folders are legacy and should not receive new files.

## Legacy folders

- `database-migrations/`
- `migrations/`
- `sql-migrations/`

These should be archived in a later, dedicated cleanup task after verification.
