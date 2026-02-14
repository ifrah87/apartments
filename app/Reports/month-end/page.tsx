import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { fetchMonthEndTasks } from "@/lib/reports/ownerReports";

type SearchParams = {
  month?: string;
};

export const runtime = "nodejs";

function defaultMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthEndPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const month = sp.month || defaultMonth();
  const tasks = await fetchMonthEndTasks(month);
  const completed = tasks.filter((task) => task.completed).length;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Month-End Close
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Month-End Close Summary</h1>
        <p className="text-sm text-slate-500">Track close checklist items and outstanding tasks.</p>
      </header>

      <SectionCard className="p-4">
        <form className="flex flex-wrap gap-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Month
            <input type="month" name="month" defaultValue={month} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Update
          </button>
        </form>
      </SectionCard>

      <SectionCard className="p-4">
        <p className="text-sm text-slate-500">Completed {completed} of {tasks.length} tasks</p>
        <progress value={completed} max={tasks.length} className="mt-2 w-full" />
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Checklist</h2>
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {tasks.map((task) => (
            <li key={task.task} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900">{task.task}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {task.completed ? "Completed" : "Pending"}
              </span>
            </li>
          ))}
          {!tasks.length && <li className="px-4 py-8 text-center text-slate-500">No tasks for this month.</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
