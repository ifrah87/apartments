import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

export type RentSummary = {
  rentCollectedMTD: number;
  overdueTenants: number;
  overdueTotal: number;
  upcomingPayments: number;
  upcomingTotal: number;
};

export async function calculateRentSummary(): Promise<RentSummary> {
  const baseUrl = await getRequestBaseUrl();
  const [tenantsRes, paymentsRes] = await Promise.all([
    fetch(`${baseUrl}/api/tenants`, { cache: "no-store" }),
    fetch(`${baseUrl}/api/payments`, { cache: "no-store" }),
  ]);

  const tenantsPayload = await tenantsRes.json();
  const paymentsPayload = await paymentsRes.json();
  const tenants = tenantsPayload?.ok === false ? [] : (tenantsPayload?.ok ? tenantsPayload.data : tenantsPayload);
  const payments = paymentsPayload?.ok === false ? [] : (paymentsPayload?.ok ? paymentsPayload.data : paymentsPayload);

  const referenceDate = deriveReferenceDate(payments);
  const thisMonth = referenceDate.getMonth();
  const thisYear = referenceDate.getFullYear();

  // 1. Rent Collected (MTD)
  const rentCollectedMTD = payments
    .filter((p: any) => {
      const d = safeDate(p.date);
      if (!d) return false;
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  // 2. Overdue tenants
  const overdue = tenants.filter(
    (t: any) => (t.status || "").toLowerCase() === "overdue"
  );

  const overdueTotal = overdue.reduce(
    (sum: number, t: any) =>
      sum + (Number(t.rent_due) || Number(t.rent) || 0),
    0
  );

  // 3. Upcoming payments (due within 7 days of reference date)
  const upcoming = tenants.filter((t: any) => {
    const due = resolveDueDate(t, referenceDate);
    if (!due) return false;
    const diffDays = (due.getTime() - referenceDate.getTime()) / DAY_IN_MS;
    return diffDays >= 0 && diffDays <= 7;
  });

  const upcomingTotal = upcoming.reduce(
    (sum: number, t: any) =>
      sum + (Number(t.rent_due) || Number(t.rent) || 0),
    0
  );

  return {
    rentCollectedMTD,
    overdueTenants: overdue.length,
    overdueTotal,
    upcomingPayments: upcoming.length,
    upcomingTotal,
  };
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function safeDate(value?: string | number | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveReferenceDate(payments: any[]): Date {
  const dates = payments
    .map((p) => safeDate(p.date))
    .filter((d): d is Date => Boolean(d));
  if (!dates.length) {
    return new Date();
  }
  return dates.reduce((latest, current) => (current > latest ? current : latest));
}

function resolveDueDate(tenant: any, referenceDate: Date): Date | null {
  const explicitDate = safeDate(tenant.due_date || tenant.next_due_date);
  if (explicitDate) {
    return explicitDate;
  }

  const dueDayRaw = tenant.due_day || tenant.dueDay;
  const dueDay = Number(dueDayRaw);
  if (!Number.isFinite(dueDay)) return null;

  const due = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dueDay);
  if (due < referenceDate) {
    due.setMonth(due.getMonth() + 1);
  }
  return due;
}
