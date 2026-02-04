import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

type OwnerSummaryRow = {
  property_id: string;
  month: string;
  rent_collected: string;
  operating_expenses: string;
  net_income: string;
  occupancy_rate: string;
  arrears_total: string;
};

type KPIRecord = {
  date: string;
  occupancy_rate: string;
  arrears_total: string;
  rent_collected: string;
  avg_days_vacant: string;
  expense_ratio: string;
  unit_profitability: string;
};

type MonthEndTaskRow = {
  month: string;
  task: string;
  completed: string;
};

export async function fetchOwnerSummary(month?: string) {
  const baseUrl = getRequestBaseUrl(headers());
  const res = await fetch(`${baseUrl}/api/monthly-owner-summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch owner summary");
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || "Failed to fetch owner summary");
  const data: OwnerSummaryRow[] = (payload?.ok ? payload.data : payload) as OwnerSummaryRow[];
  const filtered = month ? data.filter((row) => row.month === month) : data;
  return filtered.map((row) => ({
    propertyId: row.property_id,
    month: row.month,
    rentCollected: Number(row.rent_collected || 0),
    operatingExpenses: Number(row.operating_expenses || 0),
    netIncome: Number(row.net_income || 0),
    occupancyRate: Number(row.occupancy_rate || 0),
    arrearsTotal: Number(row.arrears_total || 0),
  }));
}

export async function fetchKPIDashboard() {
  const baseUrl = getRequestBaseUrl(headers());
  const res = await fetch(`${baseUrl}/api/kpi-dashboard`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch KPI dashboard");
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || "Failed to fetch KPI dashboard");
  const data: KPIRecord[] = (payload?.ok ? payload.data : payload) as KPIRecord[];
  return data.map((row) => ({
    date: row.date,
    occupancyRate: Number(row.occupancy_rate || 0),
    arrearsTotal: Number(row.arrears_total || 0),
    rentCollected: Number(row.rent_collected || 0),
    avgDaysVacant: Number(row.avg_days_vacant || 0),
    expenseRatio: Number(row.expense_ratio || 0),
    unitProfitability: Number(row.unit_profitability || 0),
  }));
}

export async function fetchMonthEndTasks(month?: string) {
  const baseUrl = getRequestBaseUrl(headers());
  const res = await fetch(`${baseUrl}/api/month-end-tasks`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch month end tasks");
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || "Failed to fetch month end tasks");
  const data: MonthEndTaskRow[] = (payload?.ok ? payload.data : payload) as MonthEndTaskRow[];
  const filtered = month ? data.filter((row) => row.month === month) : data;
  return filtered.map((row) => ({
    month: row.month,
    task: row.task,
    completed: (row.completed || "").toLowerCase() === "true",
  }));
}
