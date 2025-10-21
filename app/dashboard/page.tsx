// app/dashboard/page.tsx
import { query } from "../../lib/db";

export const runtime = "nodejs"; // ensure Node runtime

// ----------------- KPI helpers -----------------

// Rent Collected (MTD)
async function rentCollectedMTD() {
  const { rows } = await query<{ total: string }>(`
    SELECT COALESCE(SUM(amount),0)::text AS total
    FROM payments
    WHERE date_trunc('month', paid_on) = date_trunc('month', CURRENT_DATE)
  `);
  return rows[0]?.total ?? '0';
}

// Upcoming Payments (next 7 days)
async function upcomingPayments7d() {
  const { rows } = await query<{ count: string }>(`
    WITH t AS (SELECT EXTRACT(DAY FROM CURRENT_DATE)::int AS today)
    SELECT COUNT(*)::text AS count
    FROM leases, t
    WHERE status='ACTIVE'
      AND (
        (rent_day_of_month BETWEEN t.today AND t.today+7)
        OR (t.today+7 > 31 AND rent_day_of_month <= (t.today+7-31))
      )
  `);
  return rows[0]?.count ?? '0';
}

// Overdue Rent (no payment this month AND rent_day_of_month passed)
async function overdueRentCount() {
  const { rows } = await query<{ count: string }>(`
    WITH paid_this_month AS (
      SELECT DISTINCT l.id
      FROM payments p
      JOIN leases l ON l.id = p.lease_id
      WHERE date_trunc('month', p.paid_on) = date_trunc('month', CURRENT_DATE)
    ),
    t AS (SELECT EXTRACT(DAY FROM CURRENT_DATE)::int AS today)
    SELECT COUNT(*)::text AS count
    FROM leases l, t
    WHERE l.status='ACTIVE'
      AND l.rent_day_of_month < t.today
      AND l.id NOT IN (SELECT id FROM paid_this_month)
  `);
  return rows[0]?.count ?? '0';
}

// At-Risk Tenants (due day within last 3 days, unpaid this month)
async function atRiskTenantsCount() {
  const { rows } = await query<{ count: string }>(`
    WITH paid_this_month AS (
      SELECT DISTINCT l.id
      FROM payments p
      JOIN leases l ON l.id = p.lease_id
      WHERE date_trunc('month', p.paid_on) = date_trunc('month', CURRENT_DATE)
    ),
    t AS (SELECT EXTRACT(DAY FROM CURRENT_DATE)::int AS today)
    SELECT COUNT(*)::text AS count
    FROM leases l, t
    WHERE l.status='ACTIVE'
      AND l.rent_day_of_month BETWEEN GREATEST(t.today-3,1) AND t.today
      AND l.id NOT IN (SELECT id FROM paid_this_month)
  `);
  return rows[0]?.count ?? '0';
}

// ----------------- Page -----------------

export default async function DashboardPage() {
  const [mtd, upcoming, overdue, atRisk] = await Promise.all([
    rentCollectedMTD(),
    upcomingPayments7d(),
    overdueRentCount(),
    atRiskTenantsCount(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Rent Collected (MTD)</p>
          <p className="mt-2 text-2xl font-bold">£{mtd}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Upcoming Payments (7d)</p>
          <p className="mt-2 text-2xl font-bold">{upcoming}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Overdue Rent</p>
          <p className="mt-2 text-2xl font-bold">{overdue}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow">
          <p className="text-sm text-slate-500">At-Risk Tenants</p>
          <p className="mt-2 text-2xl font-bold">{atRisk}</p>
        </div>
      </div>
    </div>
  );
}
