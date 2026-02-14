"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CHART_OF_ACCOUNTS, suggestAccountForTransaction } from "@/lib/reports/chartOfAccounts";
import { fetchSettings } from "@/lib/settings/client";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/settings/defaults";
import type { ExpenseCategoriesSettings, ExpenseCategory } from "@/lib/settings/types";

type Row = {
  id: string;
  date: string;
  description: string;
  reference?: string;
  property?: string;
  amount: number;
};

type CategoryMap = Record<string, string>;

function formatMoney(amount: number) {
  const formatter = new Intl.NumberFormat("en", { style: "currency", currency: "USD" });
  return formatter.format(amount);
}

function formatDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export default function UnreconciledTable({ rows, initialCategories }: { rows: Row[]; initialCategories: CategoryMap }) {
  const [queue, setQueue] = useState(rows);
  const [categoryMap, setCategoryMap] = useState(initialCategories || {});
  const [saving, setSaving] = useState<Record<string, "idle" | "saving" | "error">>({});
  const [, startTransition] = useTransition();
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseCategory[]>(
    DEFAULT_EXPENSE_CATEGORIES.categories,
  );
  const incomeAccounts = useMemo(() => CHART_OF_ACCOUNTS.filter((acc) => acc.type === "income"), []);

  useEffect(() => {
    fetchSettings<ExpenseCategoriesSettings>("expense-categories", DEFAULT_EXPENSE_CATEGORIES).then((data) =>
      setExpenseAccounts(data.categories || DEFAULT_EXPENSE_CATEGORIES.categories),
    );
  }, []);

  const expenseOptions = useMemo(
    () =>
      expenseAccounts
        .filter((acc) => acc.active !== false)
        .map((acc) => ({ id: acc.code?.trim() || acc.id, name: acc.name })),
    [expenseAccounts],
  );

  const activeRows = queue.filter((row) => !categoryMap[row.id]);

  function handleAssign(id: string, accountId: string) {
    if (!accountId) return;
    setSaving((prev) => ({ ...prev, [id]: "saving" }));
    startTransition(() => {
      fetch("/api/transaction-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accountId }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to save");
          setCategoryMap((prev) => ({ ...prev, [id]: accountId }));
          setQueue((prev) => prev.filter((row) => row.id !== id));
          setSaving((prev) => ({ ...prev, [id]: "idle" }));
        })
        .catch((err) => {
          console.error(err);
          setSaving((prev) => ({ ...prev, [id]: "error" }));
        });
    });
  }

  return (
    <section className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rose-50 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-rose-400">Unreconciled queue</p>
          <h2 className="text-xl font-semibold text-rose-600">{activeRows.length} items need attention</h2>
          <p className="text-sm text-slate-500">
            Assign each transaction to a chart-of-accounts line to reconcile it.
          </p>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700">
          {queue.length - activeRows.length} reconciled
        </div>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-rose-50 text-xs uppercase tracking-wide text-rose-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => {
              const suggestions = row.amount >= 0 ? incomeAccounts : expenseOptions;
              const defaultAccount = suggestAccountForTransaction(row);
              const availableIds = new Set(suggestions.map((account) => account.id));
              const preferred = categoryMap[row.id] || defaultAccount.id;
              const currentValue = availableIds.has(preferred)
                ? preferred
                : suggestions[0]?.id || defaultAccount.id;
              return (
                <tr key={row.id} className="border-t border-rose-50">
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.date)}</td>
                  <td className="px-4 py-2 text-slate-900">
                    <div className="font-medium">{row.description}</div>
                    {row.property && <div className="text-xs text-slate-500">{row.property}</div>}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{row.reference || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatMoney(row.amount)}</td>
                  <td className="px-4 py-2">
                    <select
                      value={currentValue}
                      onChange={(event) => handleAssign(row.id, event.target.value)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
                    >
                      {suggestions.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {saving[row.id] === "saving" && "Saving..."}
                    {saving[row.id] === "error" && <span className="text-rose-600">Failed to save</span>}
                  </td>
                </tr>
              );
            })}
            {!activeRows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  All transactions reconciled 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
