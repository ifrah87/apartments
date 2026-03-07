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

type StoredInvoiceMetricRow = {
  total_amount: number | string | null;
  amount_paid: number | string | null;
  line_items: unknown;
  line_items_from_lines: unknown;
};

function toNumberOrZero(value: unknown) {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function deriveLineItemAmount(item: Record<string, unknown>) {
  return (
    ("amount" in item ? Number(item.amount) : NaN) ||
    ("total" in item ? Number(item.total) : NaN) ||
    ("total_cents" in item ? Number(item.total_cents) / 100 : NaN) ||
    0
  );
}

function deriveInvoiceRentAmount(lineItems: unknown) {
  if (!Array.isArray(lineItems)) return 0;

  let total = 0;
  lineItems.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    const meta =
      record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
        ? (record.meta as Record<string, unknown>)
        : null;
    const kind = String(meta?.kind || "").trim().toUpperCase();
    const description = String(record.description || "").trim().toLowerCase();
    if (kind !== "RENT" && !description.includes("rent")) return;
    total += deriveLineItemAmount(record);
  });

  return Number(total.toFixed(2));
}

async function queryFirstRow<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
  fallback: T,
): Promise<T> {
  try {
    const res = await query<T>(sql, params);
    return (res.rows[0] as T | undefined) ?? fallback;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("calculateRentSummary metric query failed; using fallback row", err);
    }
    return fallback;
  }
}

async function getInvoiceCollectedRentForMonth(propertyFilter: string, monthStartISO: string, nextMonthStartISO: string) {
  const params: unknown[] = [monthStartISO, nextMonthStartISO];
  const propertyClause = propertyFilter
    ? `AND lower(coalesce(u.property_id::text, '')) = $3`
    : "";
  if (propertyFilter) params.push(propertyFilter);

  try {
    const res = await query<StoredInvoiceMetricRow>(
      `SELECT
         i.total_amount,
         i.amount_paid,
         i.line_items,
         COALESCE(
           json_agg(
             json_build_object(
               'description', il.description,
               'amount', ROUND((il.total_cents / 100.0)::numeric, 2),
               'meta', il.meta
             )
           ) FILTER (WHERE il.id IS NOT NULL),
           NULL
         ) AS line_items_from_lines
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id = i.unit_id
       LEFT JOIN public.invoice_lines il ON il.invoice_id = i.id
       WHERE COALESCE(i.is_deleted, false) = false
         AND lower(COALESCE(i.status, '')) <> 'void'
         AND i.invoice_date >= $1
         AND i.invoice_date < $2
         ${propertyClause}
       GROUP BY i.id, i.total_amount, i.amount_paid, i.line_items`,
      params,
    );

    const collected = res.rows.reduce((sum, row) => {
      const rentAmount = deriveInvoiceRentAmount(row.line_items_from_lines ?? row.line_items);
      const totalAmount = Math.max(0, toNumberOrZero(row.total_amount));
      const amountPaid = Math.max(0, toNumberOrZero(row.amount_paid));
      // Treat payments as satisfying rent first; if rent lines are missing in legacy rows,
      // fall back to invoice total so MTD collection does not collapse to zero.
      const collectibleBase = rentAmount > 0 ? rentAmount : totalAmount;
      return sum + Math.min(collectibleBase, amountPaid);
    }, 0);

    return Number(collected.toFixed(2));
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("calculateRentSummary invoice collection query failed; using zero", err);
    }
    return 0;
  }
}

export async function calculateRentSummary(propertyFilter?: string): Promise<RentSummary> {
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

  const todayISO = today.toISOString().slice(0, 10);
  const monthStartISO = monthStart.toISOString().slice(0, 10);
  const nextMonthStartISO = nextMonthStart.toISOString().slice(0, 10);
  const sevenDaysISO = sevenDays.toISOString().slice(0, 10);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().slice(0, 10);

  const [invoiceCollectedRent, overdueRow, upcomingRow, atRiskRow] = await Promise.all([
    getInvoiceCollectedRentForMonth(normalizedFilter, monthStartISO, nextMonthStartISO),
    queryFirstRow<{ overdue_tenants: number; overdue_total: number }>(
      `SELECT
         COUNT(DISTINCT i.tenant_id)::int AS overdue_tenants,
         COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS overdue_total
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id::text = i.unit_id::text
       WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
         AND COALESCE(i.is_deleted, false) = false
         AND lower(COALESCE(i.status, '')) <> 'void'
         AND COALESCE(i.due_date, i.invoice_date) < $${propertyParams.length + 1}
         ${propertyClause}`,
      [...propertyParams, todayISO],
      { overdue_tenants: 0, overdue_total: 0 },
    ),
    queryFirstRow<{ upcoming_count: number; upcoming_total: number }>(
      `SELECT
         COUNT(DISTINCT i.tenant_id)::int AS upcoming_count,
         COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS upcoming_total
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id::text = i.unit_id::text
       WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
         AND COALESCE(i.is_deleted, false) = false
         AND lower(COALESCE(i.status, '')) <> 'void'
         AND COALESCE(i.due_date, i.invoice_date) >= $${propertyParams.length + 1}
         AND COALESCE(i.due_date, i.invoice_date) <= $${propertyParams.length + 2}
         ${propertyClause}`,
      [...propertyParams, todayISO, sevenDaysISO],
      { upcoming_count: 0, upcoming_total: 0 },
    ),
    queryFirstRow<{ at_risk_tenants: number; at_risk_total: number }>(
      `SELECT
         COUNT(DISTINCT i.tenant_id)::int AS at_risk_tenants,
         COALESCE(SUM(GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0))), 0) AS at_risk_total
       FROM public.invoices i
       LEFT JOIN public.units u ON u.id::text = i.unit_id::text
       WHERE GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)) > 0
         AND COALESCE(i.is_deleted, false) = false
         AND lower(COALESCE(i.status, '')) <> 'void'
         AND COALESCE(i.due_date, i.invoice_date) < $${propertyParams.length + 1}
         ${propertyClause}`,
      [...propertyParams, thirtyDaysAgoISO],
      { at_risk_tenants: 0, at_risk_total: 0 },
    ),
  ]);

  return {
    rentCollectedMTD: invoiceCollectedRent,
    overdueTenants: Number(overdueRow.overdue_tenants || 0),
    overdueTotal: Number(overdueRow.overdue_total || 0),
    upcomingPayments: Number(upcomingRow.upcoming_count || 0),
    upcomingTotal: Number(upcomingRow.upcoming_total || 0),
    atRiskTenants: Number(atRiskRow.at_risk_tenants || 0),
    atRiskBalance: Number(atRiskRow.at_risk_total || 0),
  };
}
