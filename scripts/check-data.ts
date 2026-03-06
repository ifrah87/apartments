import { query } from "../lib/db";

async function main() {
  // Check lease_agreements dataset
  const { rows: datasets } = await query(
    `SELECT key, jsonb_array_length(data) AS count, updated_at FROM app_datasets ORDER BY updated_at DESC`
  );
  console.log("\n--- app_datasets ---");
  for (const r of datasets) {
    console.log(`  ${r.key}: ${r.count} items (updated ${r.updated_at})`);
  }

  // Check invoices
  const { rows: invoices } = await query(
    `SELECT COUNT(*) AS count, MIN(created_at) AS oldest, MAX(created_at) AS newest FROM public.invoices`
  );
  console.log("\n--- public.invoices ---");
  console.log(`  count: ${invoices[0].count}, oldest: ${invoices[0].oldest}, newest: ${invoices[0].newest}`);

  // Check tenants
  const { rows: tenants } = await query(
    `SELECT COUNT(*) AS count FROM public.tenants`
  );
  console.log(`\n--- public.tenants ---`);
  console.log(`  count: ${tenants[0].count}`);

  // Check leases
  const { rows: leases } = await query(
    `SELECT COUNT(*) AS count FROM public.leases`
  );
  console.log(`\n--- public.leases ---`);
  console.log(`  count: ${leases[0].count}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
