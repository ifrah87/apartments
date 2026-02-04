# Runtime Data Audit (Step 1)

Date: 2026-02-04

## Summary
- No runtime API route or page reads CSV/Excel/JSON files from disk.
- CSV parsing + file reads moved to a dev-only script.
- JSON dataset keys remain, but are backed by Postgres via `datasetsRepo`.

## Runtime file reads/parsers (must be zero)
- None after changes.

## Dev-only scripts (allowed)
- `scripts/import-tenants.ts` — CSV read + papaparse for one-time import.

## Runtime JSON filename references (dataset keys; DB-backed)
- `lib/onboardingStore.ts`
- `lib/commercialStore.ts`
- `app/api/invoices/drafts/route.ts`
- `app/api/admin/house-rules/route.ts`
- `app/api/admin/sop/route.ts`

## Runtime CSV filename references (metadata / export only; no file reads)
- `lib/dataFiles.ts` (metadata registry for dataset keys)
- `app/api/reports/general-ledger/route.ts` (CSV response filename only)
- `app/api/tenants/[tenantId]/statement/route.ts` (CSV response filename only)
- `components/BankStatementExporter.tsx` (client CSV download)
- `components/PnLExporter.tsx` (client CSV download)
- `components/reports/CustomReportWorkspace.tsx` (client CSV download)
- `app/api/integrations/[filename]/route.ts` (expects `.csv` in URL; uses DB dataset)
- `app/reports/account-transactions/page.tsx` (UI copy string only)

## Docs / reference only
- `data/DATA_DICTIONARY.md` (describes legacy CSVs; not runtime)

## HTTP JSON parsing (runtime HTTP responses; not file reads)
- `app/login/page.tsx`
- `app/properties/page.tsx`
- `app/reports/ledger/page.tsx`
- `app/reports/upcoming-payments/page.tsx`
- `app/reports/tenant-ledger/page.tsx`
- `app/tenants/page.tsx`
- `app/tenants/onboarding/page.tsx`
- `app/tenants/onboarding/new/page.tsx`
- `app/tenants/onboarding/[tenantId]/page.tsx`
- `app/admin/page.tsx`
- `app/admin/sop/page.tsx`
- `app/admin/house-rules/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/tenants/orgs/page.tsx`
- `app/tenant/activate/page.tsx`
- `app/tenant/welcome/page.tsx`
- `app/tenant-org/activate/page.tsx`
- `app/tenant-org/dashboard/page.tsx`
- `app/tenant-org/documents/page.tsx`
- `app/tenant-org/facilities/page.tsx`
- `app/tenant-org/invoices/page.tsx`
- `app/tenant-org/notices/page.tsx`
- `app/tenant-org/profile/page.tsx`
- `components/HeaderActions.tsx`
- `components/ManualPaymentsManager.tsx`
- `components/dashboard/DashboardView.tsx`
- `components/reports/OverdueRentTable.tsx`
- `lib/reports/accountingReports.ts`
- `lib/reports/bankReconciliation.ts`
- `lib/reports/bankReports.ts`
- `lib/reports/customReports.ts`
- `lib/reports/depositReports.ts`
- `lib/reports/ledger.ts`
- `lib/reports/maintenanceReports.ts`
- `lib/reports/occupancyReports.ts`
- `lib/reports/ownerReports.ts`
- `lib/reports/propertyHelpers.ts`
- `lib/reports/rentInsights.ts`
- `lib/reports/rentReports.ts`
- `lib/reports/unitFinancialReports.ts`
- `lib/reports/utilityReports.ts`
- `app/readings/page.tsx`

## Action taken
- `/api/import/tenants` now requires JSON payload and no longer reads CSVs or parses CSV at runtime.
- CSV import flow moved to `scripts/import-tenants.ts` (dev-only).
