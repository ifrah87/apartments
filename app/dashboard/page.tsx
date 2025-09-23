// app/dashboard/page.tsx
import computeDashboard from "@/lib/metrics";

export default async function DashboardPage() {
  // 1) ALWAYS define data 
  let data;
  try {
    data = await computeDashboard();
  } catch (e) {
    // 2) Fallback so the page still renders even if DB is empty/blocked
    data ={
      kpis: { bankBalance: 0, rentReceived: 0, rentOverdue: 0 },
      series: [],
      atRiskTenants: [],
    };
  }
  // 3) Optional guard for truly underfined
  if (!data) {
    return (
      <div className="rounded bg-red-50 p-4 text-red-700">
        couldn't load dashboard data
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Bank Balance</p>
          <p className="text-2xl font-bold">£{data.kpis.bankBalance.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Rent Received</p>
          <p className="text-2xl font-bold">£{data.kpis.rentReceived.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Rent Overdue</p>
          <p className="text-2xl font-bold text-red-600">£{data.kpis.rentOverdue.toFixed(2)}</p>
        </div>
        </div>

{/* placeholder for chart */}
<div className="rounded-lg bg-white p-6 shadow">
        <p className="mb-4 text-lg font-semibold">12-Month Cashflow</p>
        <pre className="text-xs">{JSON.stringify(data.series.slice(0, 3), null, 2)}...</pre>
      </div>
    </div>
  );
}
  