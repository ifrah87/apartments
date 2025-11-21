"use client";

import { useMemo, useState, useTransition } from "react";
import { CHART_OF_ACCOUNTS, suggestAccountForTransaction } from "@/lib/reports/chartOfAccounts";

type Row = {
  id: string;
  date: string;
  description?: string;
  property_id?: string;
  reference?: string;
  amount: number;
};

type CategoryMap = Record<string, string>;

function formatDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(amount: number) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return formatter.format(amount);
}

export default function TransactionCategoryTable({
  transactions,
  initialCategories,
}: {
  transactions: Row[];
  initialCategories: CategoryMap;
}) {
  const [categoryMap, setCategoryMap] = useState<CategoryMap>(initialCategories || {});
  const [saving, setSaving] = useState<Record<string, "idle" | "saving" | "error">>({});
  const [, startTransition] = useTransition();

  const accountGroups = useMemo(() => {
    const income = CHART_OF_ACCOUNTS.filter((acc) => acc.type === "income");
    const expense = CHART_OF_ACCOUNTS.filter((acc) => acc.type === "expense");
    return { income, expense };
  }, []);

  function handleCategoryChange(id: string, accountId: string) {
    setCategoryMap((prev) => ({ ...prev, [id]: accountId }));
    setSaving((prev) => ({ ...prev, [id]: "saving" }));
    startTransition(() => {
      fetch("/api/transaction-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accountId }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to save");
          }
          setSaving((prev) => ({ ...prev, [id]: "idle" }));
        })
        .catch((err) => {
          console.error(err);
          setSaving((prev) => ({ ...prev, [id]: "error" }));
        });
    });
  }

  function getSelectedAccountId(row: Row) {
    return categoryMap[row.id] || suggestAccountForTransaction(row).id;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Property</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const accountId = getSelectedAccountId(txn);
            return (
              <tr key={txn.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">{formatDate(txn.date)}</td>
                <td className="px-4 py-2 text-slate-900">
                  <div className="font-medium">{txn.description || "—"}</div>
                  {txn.reference && <div className="text-xs text-slate-500">{txn.reference}</div>}
                </td>
                <td className="px-4 py-2 text-slate-600">{txn.property_id || "—"}</td>
                <td className="px-4 py-2">
                  <select
                    value={accountId}
                    onChange={(event) => handleCategoryChange(txn.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <optgroup label="Income">
                      {accountGroups.income.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Expenses">
                      {accountGroups.expense.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {saving[txn.id] === "saving" && "Saving..."}
                  {saving[txn.id] === "error" && <span className="text-rose-600">Failed to save</span>}
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    txn.amount >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {txn.amount >= 0 ? "+" : "-"}
                  {formatMoney(Math.abs(txn.amount))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
