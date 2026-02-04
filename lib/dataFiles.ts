export type DataFileConfig = {
  filename: string;
  key: string;
};

export const DATA_FILES: DataFileConfig[] = [
  { filename: "bank_all_buildings_simple.csv", key: "bank_all_buildings_simple" },
  { filename: "bank_balances.csv", key: "bank_balances" },
  { filename: "bank_import_summary.csv", key: "bank_import_summary" },
  { filename: "bank_reconciliation_items.csv", key: "bank_reconciliation_items" },
  { filename: "deposit_transactions.csv", key: "deposit_transactions" },
  { filename: "journal_entries.csv", key: "journal_entries" },
  { filename: "kpi_dashboard.csv", key: "kpi_dashboard" },
  { filename: "maintenance_tickets.csv", key: "maintenance_tickets" },
  { filename: "month_end_tasks.csv", key: "month_end_tasks" },
  { filename: "monthly_owner_summary.csv", key: "monthly_owner_summary" },
  { filename: "properties_all_buildings.csv", key: "properties_all_buildings" },
  { filename: "tenant_charges.csv", key: "tenant_charges" },
  { filename: "tenant_deposits.csv", key: "tenant_deposits" },
  { filename: "tenants_all_buildings_simple_unique.csv", key: "tenants_all_buildings_simple_unique" },
  { filename: "unit_expenses.csv", key: "unit_expenses" },
  { filename: "unit_inventory.csv", key: "unit_inventory" },
  { filename: "unit_turnover.csv", key: "unit_turnover" },
  { filename: "units_master_66.csv", key: "units_master_66" },
];

export const DATA_FILE_SET = new Set(DATA_FILES.map((file) => file.filename));
