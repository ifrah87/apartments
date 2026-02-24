import { query } from "@/lib/db";

async function run() {
  const { rows } = await query<{
    id: string;
    name: string;
    unit_count: string;
  }>(
    `SELECT p.id, p.name,
            (SELECT COUNT(*) FROM public.units u WHERE u.property_id = p.id) AS unit_count
     FROM public.properties p
     WHERE lower(p.name) = 'orfane tower'
     ORDER BY unit_count::int DESC, p.created_at DESC`,
  );

  if (!rows.length) {
    console.log("No Orfane Tower properties found.");
    return;
  }

  const keep = rows[0];
  const keepId = keep.id;
  const deletions = rows.filter((row) => row.id !== keepId);

  if (!deletions.length) {
    console.log(`Only one Orfane Tower remains (${keepId}).`);
    return;
  }

  const deletable = deletions.filter((row) => Number(row.unit_count) === 0);
  if (!deletable.length) {
    console.log("No empty duplicate Orfane Tower properties to delete.");
    return;
  }

  const ids = deletable.map((row) => row.id);
  await query(`DELETE FROM public.properties WHERE id = ANY($1::uuid[])`, [ids]);

  console.log(`Kept ${keepId} and deleted ${ids.length} empty duplicates:`, ids);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
