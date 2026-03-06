import { query } from "@/lib/db";

export type RentSummary = {
  rentCollectedMTD: number;
  overdueTenants: number;
  overdueTotal: number;
  upcomingPayments: number;
  upcomingTotal: number;
  atRiskTenants: number;
  atRiskBalance: number;
};

export async function calculateRentSummary(propertyFilter?: string): Promise<RentSummary> {
  try {
    const normalizedFilter = String(propertyFilter || "").trim().toLowerCase();
    const propertyClause = normalizedFilter
      ? `AND lower(coalesce(u.property_id::text, '')) = $1`
      : "";
    const propertyParams = normalizedFilter ? [normalizedFilter] : [];

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
    const today = new Date();
    const sevenDays = new Date(today);
    sevenDays.setUTCDate(sevenDays.getUTCDate() + 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [collectedRes, overdueRes, upcomingRes, atRiskRes] = await Promise.all([
      query<{ amount: number }>(
        `SELECT COALESCE(SUM(ba.allocated_amount), 0) AS amount
         FROM public.bank_allocations ba
         JOIN public.bank_transactions bt ON bt.id = ba.transaction_id
         JOIN public.invoices i ON i.id::text = ba.invoice_id::text
         LEFT JOIN public.units u ON u.id::text = i.unit_id::text
         WHERE bt.txn_date >= $${propertyParams.length + 1}
           AND bt.txn_date < $${propertyParams.length + 2}
           ${propertyClause}`,
        [...propertyParams, monthStart.toISOString().slice(0, 10), nextMonthStart.toISOString().slice(0, 10)],
      ),
      query<{ overdue_tenants: number; overdue_total: number }>(
        `SELECT
           COUNT(DISTINCT i.tenant_id)::int AS overdue_tenants,
           COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS overdue_total
         FROM public.invoices i
         LEFT JOIN public.units u ON u.id::text = i.unit_id::text
         WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
           AND COALESCE(i.due_date, i.invoice_date) < $${propertyParams.length + 1}
           ${propertyClause}`,
        [...propertyParams, today.toISOString().slice(0, 10)],
      ),
      query<{ upcoming_count: number; upcoming_total: number }>(
        `SELECT
           COUNT(DISTINCT i.tenant_id)::int AS upcoming_count,
           COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS upcoming_total
         FROM public.invoices i
         LEFT JOIN public.units u ON u.id::text = i.unit_id::text
         WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
           AND COALESCE(i.due_date, i.invoice_date) >= $${propertyParams.length + 1}
           AND COALESCE(i.due_date, i.invoice_date) <= $${propertyParams.length + 2}
           ${propertyClause}`,
        [...propertyParams, today.toISOString().slice(0, 10), sevenDays.toISOString().slice(0, 10)],
      ),
      query<{ at_risk_tenants: number; at_risk_total: number }>(
        `SELECT
           COUNT(DISTINCT i.tenant_id)::int AS at_risk_tenants,
           COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS at_risk_total
         FROM public.invoices i
         LEFT JOIN public.units u ON u.id::text = i.unit_id::text
         WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
           AND COALESCE(i.due_date, i.invoice_date) < $${propertyParams.length + 1}
           ${propertyClause}`,
        [...propertyParams, thirtyDaysAgo.toISOString().slice(0, 10)],
      ),
    ]);

    return {
      rentCollectedMTD: Number(collectedRes.rows[0]?.amount || 0),
      overdueTenants: Number(overdueRes.rows[0]?.overdue_tenants || 0),
      overdueTotal: Number(overdueRes.rows[0]?.overdue_total || 0),
      upcomingPayments: Number(upcomingRes.rows[0]?.upcoming_count || 0),
      upcomingTotal: Number(upcomingRes.rows[0]?.upcoming_total || 0),
      atRiskTenants: Number(atRiskRes.rows[0]?.at_risk_tenants || 0),
      atRiskBalance: Number(atRiskRes.rows[0]?.at_risk_total || 0),
    };
  } catch (err) {
    console.error("calculateRentSummary failed, using safe defaults", err);
    return {
      rentCollectedMTD: 0,
      overdueTenants: 0,
      overdueTotal: 0,
      upcomingPayments: 0,
      upcomingTotal: 0,
      atRiskTenants: 0,
      atRiskBalance: 0,
    };
  }
}

