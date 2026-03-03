"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import SectionCard from "@/components/ui/SectionCard";

type Task = {
  month: string;
  task: string;
  category: string;
  order: number;
  completed: boolean;
};

function defaultMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

const CATEGORY_ORDER = ["Billing", "Utilities", "Banking", "Collections", "Reconciliation", "Admin"];

export default function MonthEndPage() {
  return (
    <Suspense fallback={<div className="space-y-6 p-6 text-sm text-slate-400">Loading month-end close...</div>}>
      <MonthEndPageContent />
    </Suspense>
  );
}

function MonthEndPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("month") || defaultMonth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/month-end-tasks?month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.data)) {
          setTasks(payload.data.sort((a: Task, b: Task) => a.order - b.order));
        }
      })
      .finally(() => setLoading(false));
  }, [month]);

  const toggle = async (task: Task) => {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => t.task === task.task ? { ...t, completed: next } : t));
    await fetch("/api/month-end-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, task: task.task, completed: next }),
    });
  };

  const completed = tasks.filter((t) => t.completed).length;
  const categories = CATEGORY_ORDER.filter((cat) => tasks.some((t) => t.category === cat));

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/Reports" className="text-indigo-600 hover:underline">Reports</Link>{" "}/ Month-End Close
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Month-End Close</h1>
        <p className="text-sm text-slate-500">Work through this checklist every month. No shortcuts.</p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => router.push(`?month=${data.get("month")}`));
          }}
          className="flex items-center gap-3"
        >
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            Go
          </button>
        </form>
        <div className="flex items-center gap-3 text-sm">
          <span className={`font-semibold ${completed === tasks.length && tasks.length > 0 ? "text-emerald-600" : "text-slate-700"}`}>
            {completed} / {tasks.length} done
          </span>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${completed === tasks.length && tasks.length > 0 ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: tasks.length ? `${Math.round((completed / tasks.length) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const catTasks = tasks.filter((t) => t.category === category);
            const catDone = catTasks.filter((t) => t.completed).length;
            return (
              <SectionCard key={category} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-700">{category}</h2>
                  <span className="text-xs text-slate-400">{catDone}/{catTasks.length}</span>
                </div>
                <ul className="divide-y divide-slate-100 text-sm">
                  {catTasks.map((task) => (
                    <li key={task.task} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(task)}
                        className={`h-5 w-5 flex-shrink-0 rounded border-2 transition-colors ${
                          task.completed
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300 bg-white hover:border-indigo-400"
                        }`}
                      >
                        {task.completed && (
                          <svg viewBox="0 0 12 12" fill="none" className="h-full w-full p-0.5">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className={task.completed ? "text-slate-400 line-through" : "text-slate-800"}>
                        {task.task}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
