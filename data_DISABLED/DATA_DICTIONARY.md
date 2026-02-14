# Apartments Data Dictionary

Quick reference for every CSV under `data/` so new contributors can see what each file powers, the important columns, and how it ties back to other sheets.

| File | Primary Purpose | Key Columns | Notes & Relationships |
| --- | --- | --- | --- |
| `bank_all_buildings_simple.csv` | Bank transaction ledger used for rent/fee reconciliation per property and tenant. | `date`, `description`, `amount`, `type`, `property_id`, `tenant_id` | Feed for cash vs. GL matching. Joins to tenants via `tenant_id` and to properties via `property_id`. |
| `bank_import_summary.csv` | Status snapshot of each bank import (counts of matched/unmatched lines). | `import_date`, `total_lines`, `matched`, `unmatched`, `reconciled` | Use alongside the transaction ledger to monitor reconciliation progress. |
| `bank_reconciliation_items.csv` | Outstanding or in-transit items explaining timing differences in bank recs. | `property_id`, `date`, `description`, `amount`, `type` | Clearing this list should bring the bank balance in line with the GL. |
| `deposit_transactions.csv` | Detailed log of security deposit charges, receipts, and releases. | `tenant_id`, `date`, `type`, `amount`, `note` | Summarizes into `tenant_deposits.csv`. Pairs with tenant roster via `tenant_id`. |
| `journal_entries.csv` | Double-entry postings for exporting to accounting/GL. | `entry_id`, `property_id`, `date`, `account_id`, `description`, `debit`, `credit` | Totals should tie to bank inflows, tenant charges, and expense sheets. |
| `kpi_dashboard.csv` | Weekly KPI snapshots for ops/owner dashboards. | `date`, `occupancy_rate`, `arrears_total`, `rent_collected`, `avg_days_vacant`, `expense_ratio`, `unit_profitability` | Derived from tenant, unit, and expense data; avoids recomputing metrics in the UI. |
| `maintenance_tickets.csv` | Work-order tracker with SLA, vendor, cost, and narrative details. | `ticket_id`, `property_id`, `unit`, `category`, `priority`, `status`, `opened_at`, `closed_at`, `vendor`, `cost`, `description` | Combine with `unit_expenses.csv` to understand maintenance spend per unit. |
| `month_end_tasks.csv` | Checklist of recurring close tasks and completion flags. | `month`, `task`, `completed` | Drives the month-end workflow UI; tie items to automation status. |
| `monthly_owner_summary.csv` | Owner-ready P&L snapshot per property and month. | `property_id`, `month`, `rent_collected`, `operating_expenses`, `net_income`, `occupancy_rate`, `arrears_total` | Aggregates data from rents, expenses, and KPIs; feed directly to owner statements. |
| `properties_all_buildings.csv` | Canonical list of properties/buildings and unit counts. | `property_id`, `building`, `units` | Dimension table for almost every other sheet that references properties. |
| `tenant_charges.csv` | All tenant-facing charges and payments beyond base rent. | `tenant_id`, `date`, `amount`, `paid_amount`, `description`, `category`, `communal`, `property_id` | Join with tenant roster to show statements; `category` differentiates utilities vs. fees. |
| `tenant_deposits.csv` | Current deposit balances/notes per tenant. | `tenant_id`, `deposit_charged`, `deposit_received`, `deposit_released`, `deposit_notes` | Should equal the net of `deposit_transactions.csv` grouped by tenant. |
| `tenants_all_buildings.csv` | Full tenant roster with rent terms per unit. | `id`, `name`, `building`, `property_id`, `unit`, `monthly_rent`, `due_day`, `reference` | Primary tenant dimension referenced by charges, ledger, deposits, and maintenance. |
| `tenants_all_buildings_simple_unique.csv` | Deduped tenant roster for CRM/contact use (removes “#1/#2” suffixes). | `id`, `name`, `building`, `property_id`, `unit`, `monthly_rent`, `due_day`, `reference` | Use when a clean tenant name list is required; same IDs as the full roster. |
| `unit_expenses.csv` | Itemized unit-level maintenance/capex spend. | `property_id`, `unit`, `date`, `amount`, `category`, `description` | Adds financial context to maintenance tickets and feeds profitability analysis. |
| `unit_inventory.csv` | Detailed rent roll with type, beds, rent, and status. | `property_id`, `unit`, `unit_type`, `beds`, `floor`, `rent`, `status` | Merge with KPIs to calculate occupancy/vacancy and support leasing UI filters. |
| `unit_turnover.csv` | Move-in/out history and vacancy days per unit. | `property_id`, `unit`, `last_move_in`, `last_move_out`, `days_vacant_ytd`, `notes` | Feed into `kpi_dashboard.csv` for vacancy stats and turnover planning. |
| `units_by_floor_summary_updated.csv` | Floor-level aggregation of unit counts and rent totals. | `floor`, `total_units`, `studios`, `three_beds`, `four_beds`, `total_rent`, `avg_rent` | Derived view for elevator/load planning and floor-based reporting. |
| `units_master_66.csv` | Master list of the 66 Taleex units with basic attributes. | `unit`, `floor`, `type`, `beds`, `rent`, `status` | Baseline inventory used to seed `unit_inventory.csv` and validate counts. |

## Usage Tips
- Treat `properties_all_buildings.csv`, `tenants_all_buildings.csv`, and `units_master_66.csv` as dimension tables—build joins off them first.
- Reconciliation chain: tenant charges → bank ledger → bank import summary → bank reconciliation items.
- KPI/owner reporting chain: unit inventory + tenant roster + unit expenses → KPI dashboard → monthly owner summary.
- Deposit handling: `deposit_transactions.csv` is the event log, `tenant_deposits.csv` is the balance sheet snapshot used for compliance.
