// lib/metrics.ts — SQL-backed + table-existence guards
import { prisma as prismaFromDb } from "./db";
import { PrismaClient } from "@prisma/client";

const prisma = prismaFromDb ?? new PrismaClient();

export type CashflowPoint = { month: string; inflows: number; outflows: number; net: number };
export type Kpis = { bankBalance: number; rentReceived: number; rentOverdue: number; cashflowMoM: number };
export type AtRiskTenant = { reference: string; overdue: number };
export type DashboardData = { kpis: Kpis; series: CashflowPoint[]; atRiskTenants: AtRiskTenant[] };

const n = (x: any) => (x == null ? 0 : Number(x));
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function computeDashboard(): Promise<DashboardData> {
  const EMPTY: DashboardData = {
    kpis: { bankBalance: 0, rentReceived: 0, rentOverdue: 0, cashflowMoM: 0 },
    series: [],
    atRiskTenants: [],
  };

  // Check tables exist without referencing them directly (avoids 42P01)
  const [bankExistsRow] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public.bank_transactions') IS NOT NULL AS exists;
  `;
  const bankExists = !!bankExistsRow?.exists;
  if (!bankExists) return EMPTY;

  const [tenantsExistsRow] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('public.tenants') IS NOT NULL AS exists;
  `;
  const tenantsExist = !!tenantsExistsRow?.exists;

  // 12-month series from bank_transactions
  const rawSeries = await prisma.$queryRaw<
    { month: string; inflows: number | null; outflows: number | null; net: number | null }[]
  >`
    WITH months AS (
      SELECT date_trunc('month', CURRENT_DATE) - (n || ' months')::interval AS mstart
      FROM generate_series(11,0,-1) AS n
    ),
    sums AS (
      SELECT
        date_trunc('month', b.tx_date) AS m,
        SUM(CASE WHEN b.amount > 0 THEN b.amount ELSE 0 END) AS inflows,
        SUM(CASE WHEN b.amount < 0 THEN -b.amount ELSE 0 END) AS outflows,
        SUM(b.amount) AS net
      FROM public.bank_transactions b
      WHERE b.tx_date >= date_trunc('month', CURRENT_DATE) - interval '11 months'
        AND b.tx_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
      GROUP BY 1
    )
    SELECT to_char(mo.mstart, 'YYYY-MM') AS month,
           COALESCE(s.inflows,0)  AS inflows,
           COALESCE(s.outflows,0) AS outflows,
           COALESCE(s.net,0)      AS net
    FROM months mo
    LEFT JOIN sums s ON s.m = mo.mstart
    ORDER BY mo.mstart;
  `;
  const series: CashflowPoint[] = rawSeries.map(r => ({
    month: r.month, inflows: n(r.inflows), outflows: n(r.outflows), net: n(r.net),
  }));

  // KPIs from bank_transactions
  const [balRow] = await prisma.$queryRaw<{ balance: number | null }[]>`
    SELECT COALESCE(SUM(amount),0) AS balance FROM public.bank_transactions;
  `;
  const bankBalance = n(balRow?.balance);

  const [rentRow] = await prisma.$queryRaw<{ rent_mtd: number | null }[]>`
    SELECT COALESCE(SUM(amount),0) AS rent_mtd
    FROM public.bank_transactions
    WHERE amount > 0
      AND tx_date >= date_trunc('month', CURRENT_DATE)
      AND tx_date <  date_trunc('month', CURRENT_DATE) + interval '1 month'
      AND (description ILIKE '%rent%' OR description ILIKE '%tenant%' OR description ILIKE '%unit%');
  `;
  const rentReceived = n(rentRow?.rent_mtd);

  // Expected rent (only if tenants table exists)
  let expected = 0;
  if (tenantsExist) {
    const [expRow] = await prisma.$queryRaw<{ expected: number | null }[]>`
      SELECT COALESCE(SUM(
        CASE WHEN monthly_rent IS NOT NULL THEN monthly_rent::numeric ELSE 0 END
      ),0) AS expected
      FROM public.tenants;
    `;
    expected = n(expRow?.expected);
  }
  const rentOverdue = Math.max(expected - rentReceived, 0);

  // MoM calc
  const now = new Date();
  const m = new Map(series.map(s => [s.month, s]));
  const netThis = m.get(monthKey(now))?.net ?? 0;
  const netLast = m.get(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)))?.net ?? 0;
  const cashflowMoM = netLast !== 0 ? ((netThis - netLast) / Math.abs(netLast)) * 100 : 0;

  // At-risk tenants (only if tenants exist and there *is* overdue)
  let atRiskTenants: AtRiskTenant[] = [];
  if (tenantsExist && rentOverdue > 0) {
    const rows = await prisma.$queryRaw<{ reference: string | null; monthly: number | null }[]>`
      SELECT COALESCE(tenant_name,'Unknown') AS reference,
             COALESCE(monthly_rent,0) AS monthly
      FROM public.tenants
      WHERE COALESCE(monthly_rent,0) > 0
      ORDER BY monthly DESC
      LIMIT 50;
    `;
    atRiskTenants = rows.map(r => ({ reference: r.reference ?? "Unknown", overdue: n(r.monthly) })).slice(0, 8);
  }

  return { kpis: { bankBalance, rentReceived, rentOverdue, cashflowMoM }, series, atRiskTenants };
}
