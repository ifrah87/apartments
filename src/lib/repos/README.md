## Runtime Data Source Rule

- No API route or page may read CSV, Excel, or JSON files at runtime.
- All runtime reads/writes MUST go through Postgres repos.
- CSV/Excel is allowed ONLY in:
  - one-time import scripts
  - migrations
  - tests
