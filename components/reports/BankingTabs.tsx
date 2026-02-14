"use client";

import { useMemo, useState } from "react";
import BankStatementExporter from "@/components/BankStatementExporter";

type TabKey = "bank" | "reconciled" | "account";

type StatementRow = {
  id: string;
  date: string;
  description: string;
  reference: string;
  property: string;
  amount: number;
  runningBalance: number;
  status: "reconciled" | "unreconciled";
  source?: string;
};

const TAB_LABELS: Record<TabKey, string> = {
  reconciled: "Reconcile",
  bank: "Bank statements",
  account: "Account transactions",
};
const TAB_ORDER: TabKey[] = ["reconciled", "bank", "account"];

export type BankingTabsProps = {
  rows: StatementRow[];
  start: string;
  end: string;
  defaultTab?: TabKey;
  onlyUnreconciled?: boolean;
  openingBalance: number;
};

export default function BankingTabs({
  rows,
  start,
  end,
  defaultTab = "bank",
  onlyUnreconciled = false,
  openingBalance,
}: BankingTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [lineState, setLineState] = useState(rows);
  const [filterMode, setFilterMode] = useState<"all" | "unreconciled">(onlyUnreconciled ? "unreconciled" : "all");

  const stats = useMemo(() => {
    const reconciled = lineState.filter((line) => line.status === "reconciled").length;
    const unreconciled = lineState.length - reconciled;
    return { reconciled, unreconciled };
  }, [lineState]);

  const handleMarkReconciled = (id: string) => {
    setLineState((prev) => prev.map((line) => (line.id === id ? { ...line, status: "reconciled" } : line)));
  };

  const handleRedo = (id: string) => {
    setLineState((prev) => prev.map((line) => (line.id === id ? { ...line, status: "unreconciled" } : line)));
  };

  const handleRemove = (id: string) => {
    setLineState((prev) => prev.filter((line) => line.id !== id));
  };

  const bankRows =
    filterMode === "unreconciled" ? lineState.filter((line) => line.status === "unreconciled") : lineState;
  const reconciledRows = lineState.filter((line) => line.status === "reconciled");
  const accountRows = lineState.map((line) => ({
    ...line,
    type: line.amount >= 0 ? "Credit" : "Debit",
    debit: line.amount < 0 ? Math.abs(line.amount) : 0,
    credit: line.amount >= 0 ? line.amount : 0,
  }));

  const exporterRows = useMemo(() => {
    let dataset: StatementRow[] = bankRows;
    if (activeTab === "reconciled") dataset = reconciledRows;
    if (activeTab === "account") dataset = lineState;
    return dataset.map((line) => ({
      id: line.id,
      date: line.date,
      description: line.description,
      reference: line.reference,
      property: line.property,
      debit: line.amount < 0 ? Math.abs(line.amount) : 0,
      credit: line.amount >= 0 ? line.amount : 0,
      balance: line.runningBalance,
    }));
  }, [activeTab, bankRows, reconciledRows, lineState]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
          <TabNav activeTab={activeTab} onSelect={setActiveTab} />
          <div className="flex items-center gap-2 text-xs font-normal uppercase tracking-wide text-slate-500">
            <StatBadge
              label="Reconciled items"
              value={stats.reconciled}
              active={activeTab === "reconciled"}
              onClick={() => setActiveTab("reconciled")}
            />
            <StatBadge
              label="Unreconciled"
              value={stats.unreconciled}
              active={filterMode === "unreconciled" && activeTab === "bank"}
              onClick={() => {
                setActiveTab("bank");
                setFilterMode((prev) => (prev === "unreconciled" ? "all" : "unreconciled"));
              }}
            />
          </div>
        </div>
        <BankStatementExporter rows={exporterRows} fileName={`bank-statement-${start}-to-${end}`} />
      </div>
      <div className="px-6 pb-6">
        {activeTab === "reconciled" && (
          <Table rows={reconciledRows} emptyLabel="No reconciled entries yet." onRedo={handleRedo} onRemove={handleRemove} />
        )}
        {activeTab === "bank" && (
          <Table
            rows={bankRows}
            emptyLabel="No statement lines for this period."
            onMarkReconciled={handleMarkReconciled}
            onRedo={handleRedo}
            onRemove={handleRemove}
            openingBalance={openingBalance}
            periodStart={start}
          />
        )}
        {activeTab === "account" && (
          <AccountTable
            rows={accountRows}
            emptyLabel="No account transactions."
            onMarkReconciled={handleMarkReconciled}
            onRedo={handleRedo}
            onRemove={handleRemove}
          />
        )}
      </div>
    </div>
  );
}

function TabNav({ activeTab, onSelect }: { activeTab: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <div className="flex gap-3 text-sm">
      {TAB_ORDER.map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className={`border-b-2 pb-1 font-semibold ${
              active ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}

function StatBadge({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
        active ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{value}</span>
    </button>
  );
}

type TableProps = {
  rows: StatementRow[];
  emptyLabel: string;
  onMarkReconciled?: (id: string) => void;
  onRedo?: (id: string) => void;
  onRemove?: (id: string) => void;
  openingBalance?: number;
  periodStart?: string;
};

function Table({ rows, emptyLabel, onMarkReconciled, onRedo, onRemove, openingBalance, periodStart }: TableProps) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2">Property</th>
            <th className="px-4 py-2 text-right">Debit</th>
            <th className="px-4 py-2 text-right">Credit</th>
            <th className="px-4 py-2 text-right">Balance</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {typeof openingBalance === "number" && periodStart && (
            <tr className="border-t border-slate-100 bg-slate-50">
              <td className="px-4 py-2 text-slate-600">{formatDisplayDate(periodStart)}</td>
              <td className="px-4 py-2 font-semibold text-slate-900">Opening Balance</td>
              <td className="px-4 py-2 text-slate-500">—</td>
              <td className="px-4 py-2 text-slate-500">—</td>
              <td className="px-4 py-2 text-right text-slate-500">—</td>
              <td className="px-4 py-2 text-right text-slate-500">—</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">${formatNumber(openingBalance)}</td>
              <td className="px-4 py-2 text-slate-500">—</td>
              <td className="px-4 py-2 text-right text-slate-500">—</td>
            </tr>
          )}
          {rows.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-600">{formatDisplayDate(line.date)}</td>
              <td className="px-4 py-2 text-slate-900">{line.description || "—"}</td>
              <td className="px-4 py-2 text-slate-500">{line.reference || "—"}</td>
              <td className="px-4 py-2 text-slate-500">{line.property || "—"}</td>
              <td className="px-4 py-2 text-right font-medium text-rose-600">
                {line.amount < 0 ? `$${formatNumber(Math.abs(line.amount))}` : "—"}
              </td>
              <td className="px-4 py-2 text-right font-medium text-emerald-600">
                {line.amount >= 0 ? `$${formatNumber(line.amount)}` : "—"}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">${formatNumber(line.runningBalance)}</td>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    line.status === "reconciled"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {line.status === "reconciled" ? "Reconciled" : "Unreconciled"}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <Actions
                  status={line.status}
                  onMarkReconciled={onMarkReconciled ? () => onMarkReconciled(line.id) : undefined}
                  onRedo={onRedo ? () => onRedo(line.id) : undefined}
                  onRemove={onRemove ? () => onRemove(line.id) : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountTable({
  rows,
  emptyLabel,
  onMarkReconciled,
  onRedo,
  onRemove,
}: {
  rows: (StatementRow & { type: string; debit: number; credit: number })[];
  emptyLabel: string;
  onMarkReconciled?: (id: string) => void;
  onRedo?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-right">Balance</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-600">{formatDisplayDate(line.date)}</td>
              <td className="px-4 py-2 text-slate-900">{line.type}</td>
              <td className="px-4 py-2 text-slate-900">{line.description || "—"}</td>
              <td className="px-4 py-2 text-slate-500">{line.reference || "—"}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">${formatNumber(Math.abs(line.amount))}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">${formatNumber(line.runningBalance)}</td>
              <td className="px-4 py-2 text-slate-500">{line.source || "Imported"}</td>
              <td className="px-4 py-2 text-right">
                <Actions
                  status={line.status}
                  onMarkReconciled={onMarkReconciled ? () => onMarkReconciled(line.id) : undefined}
                  onRedo={onRedo ? () => onRedo(line.id) : undefined}
                  onRemove={onRemove ? () => onRemove(line.id) : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actions({
  status,
  onMarkReconciled,
  onRedo,
  onRemove,
}: {
  status: "reconciled" | "unreconciled";
  onMarkReconciled?: () => void;
  onRedo?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      {status === "unreconciled" && onMarkReconciled && (
        <button
          type="button"
          onClick={onMarkReconciled}
          className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-600"
        >
          Mark reconciled
        </button>
      )}
      {status === "reconciled" && onRedo && (
        <button type="button" onClick={onRedo} className="rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-600">
          Redo
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-600">
          Remove
        </button>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatDisplayDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
