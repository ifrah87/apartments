"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import StatCard from "@/components/ui/StatCard";
import CashflowWidget, { type CashflowPoint } from "@/components/CashflowWidget";
import { useTranslations } from "@/components/LanguageProvider";
import { buildRentReminderBody, isPastGracePeriod } from "@/lib/smsTemplates";
import type { RentSummary } from "@/lib/reports/rentReports";
import type { OverdueRow } from "@/lib/reports/rentInsights";
import type { Txn } from "@/lib/reports/ledger";
import type { OccupancySummary, TurnoverSummary } from "@/lib/reports/occupancyReports";
import Link from "next/link";

type BankSummary = {
  bankBalance: number;
  unreconciledCount: number;
  lastUpdatedISO: string | null;
};

type AtRiskRow = OverdueRow & {
  dueDate?: string;
  paidDate?: string;
  lateMonthsCount?: number;
  lateMonthsWindow?: number;
};

type Props = {
  rent: RentSummary;
  bank: BankSummary;
  ledgerLink: string;
  cashflowSeries: CashflowPoint[];
  overdueRows: OverdueRow[];
  atRiskRows: AtRiskRow[];
  recentIn: Txn[];
  recentOut: Txn[];
  occupancy: OccupancySummary;
  turnover: TurnoverSummary;
};

type TenantRecord = {
  id: string;
  name: string;
  building?: string;
  property_id?: string;
  unit?: string;
  phone?: string;
  monthly_rent?: string;
  due_day?: string;
};

export default function DashboardView({
  rent,
  bank,
  ledgerLink,
  cashflowSeries,
  overdueRows,
  atRiskRows,
  recentIn,
  recentOut,
  occupancy,
  turnover,
}: Props) {
  const { t, language } = useTranslations();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [smsSendingKey, setSmsSendingKey] = useState<string | null>(null);
  const locale = language === "so" ? "so-SO" : "en-US";
  const lastUpdatedText = bank.lastUpdatedISO
    ? new Date(bank.lastUpdatedISO).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : t("common.never");
  const lastSyncedLabel = t("dashboard.lastSynced", { timestamp: lastUpdatedText });

  useEffect(() => {
    fetch(`/api/tenants?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) =>
        setTenants(payload?.ok === false ? [] : (payload?.ok ? payload.data : payload) || []),
      )
      .catch(() => setTenants([]));
  }, []);

  const tenantIndex = useMemo(() => {
    const map = new Map<string, TenantRecord>();
    tenants.forEach((tenant) => {
      const key = makeTenantKey(tenant.name, tenant.unit, tenant.property_id || tenant.building || "");
      if (key) map.set(key, tenant);
    });
    return map;
  }, [tenants]);

  const handleSendLateSms = async (tenant: TenantRecord, rowKey: string) => {
    if (!tenant.phone) return;
    setSmsSendingKey(rowKey);
    try {
      const body = buildRentReminderBody({
        name: tenant.name,
        monthlyRent: tenant.monthly_rent,
        dueDay: tenant.due_day,
        locale,
      });
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: tenant.phone, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "SMS failed");
      }
      window.alert("SMS sent.");
    } catch {
      window.alert("Failed to send SMS.");
    } finally {
      setSmsSendingKey(null);
    }
  };

  const topStats = [
    {
      label: t("dashboard.stats.rentCollected"),
      value: formatCurrency(rent.rentCollectedMTD),
      href: "#recent-payments",
    },
    {
      label: t("dashboard.stats.upcoming"),
      value:
        rent.upcomingPayments === 0 ? (
          <span className="text-sm font-semibold text-slate-600">No payments due in next 7 days</span>
        ) : (
          formatCurrency(rent.upcomingTotal)
        ),
      subtitle: rent.upcomingPayments === 0 ? undefined : t("dashboard.stats.upcomingSubtitle", { count: rent.upcomingPayments }),
      href: "#recent-payments",
    },
    {
      label: t("dashboard.stats.overdue"),
      value: formatCurrency(rent.overdueTotal),
      subtitle: t("dashboard.stats.overdueSubtitle", { count: rent.overdueTenants }),
      href: "#overdue-list",
    },
    {
      label: t("dashboard.stats.tenantsAtRisk"),
      value: rent.atRiskTenants,
      subtitle: t("dashboard.stats.tenantsAtRiskSubtitle", {
        amount: formatCurrency(rent.atRiskBalance),
      }),
      href: "#at-risk-list",
    },
    {
      label: t("dashboard.stats.occupancyRate"),
      value: formatPercent(occupancy.occupancyRate),
      subtitle: t("dashboard.stats.occupancySubtitle", {
        occupied: occupancy.occupiedUnits,
        total: occupancy.totalUnits,
      }),
      href: "/reports/occupancy",
    },
    {
      label: t("dashboard.stats.turnover"),
      value: formatPercent(turnover.turnoverRate),
      subtitle: t("dashboard.stats.turnoverSubtitle", { count: turnover.moveOuts }),
      href: "/reports/occupancy",
    },
  ];

  const unreconciledKey =
    bank.unreconciledCount === 1 ? "dashboard.unreconciledSingle" : "dashboard.unreconciledPlural";

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t("dashboard.title")}</h1>
        <p className="text-sm text-slate-600">{t("dashboard.subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs">{t("dashboard.bankBalance")}</span>
            <Link href="/reports/bank-summary" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              {t("dashboard.viewReport")}
            </Link>
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {formatCurrency(bank.bankBalance)}
          </div>
          <Link
            href="/reports/bank-summary?view=unreconciled"
            className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
          >
            {t(unreconciledKey, { count: bank.unreconciledCount })}
          </Link>
          <div className="text-xs text-slate-400">{lastSyncedLabel}</div>
        </SectionCard>
        {topStats.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtitle={card.subtitle}
            href={card.href}
          />
        ))}
      </div>

      <SectionCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("dashboard.cashBadge")}</p>
            <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.cashTitle")}</h2>
          </div>
        </div>
        <div className="mt-4">
          <CashflowWidget points={cashflowSeries} link="/reports/bank-summary" />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <div id="overdue-list">
          <SectionCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.overdueTitle")}</h2>
              <div className="flex items-center gap-3">
                <Link href="/tenants" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  Late rent reminder
                </Link>
                <Link href="/reports/overdue-rent?days=14&status=all" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  {t("dashboard.viewReport")}
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
              <span>{t("dashboard.summaryLabel")}</span>
              <span>{formatCurrency(sumRows(overdueRows))} · {overdueRows.length} {t("dashboard.summaryTenants")}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">{t("dashboard.table.tenant")}</th>
                    <th className="px-4 py-2">{t("dashboard.table.unit")}</th>
                    <th className="px-4 py-2 text-right">{t("dashboard.table.balance")}</th>
                    <th className="px-4 py-2 text-right">{t("dashboard.table.daysLate")}</th>
                    <th className="px-4 py-2 text-right">SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueRows.slice(0, 10).map((row) => {
                    const rowKey = `${row.propertyId}-${row.unit}-${row.tenant}`;
                    const tenant = tenantIndex.get(makeTenantKey(row.tenant, row.unit, row.propertyId));
                    const isLate = tenant ? isPastGracePeriod({ dueDay: tenant.due_day }) : false;
                    const canSend = Boolean(tenant?.phone && isLate);
                    return (
                      <tr key={rowKey} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-900">
                          <div className="font-semibold">{row.tenant}</div>
                          <div className="text-xs text-slate-500">{row.propertyName || row.propertyId}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.unit}</td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-600">
                          {formatCurrency(row.outstandingBalance)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.daysOverdue}</td>
                        <td className="px-4 py-3 text-right">
                          {canSend ? (
                            <button
                              type="button"
                              onClick={() => handleSendLateSms(tenant!, rowKey)}
                              disabled={smsSendingKey === rowKey}
                              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {smsSendingKey === rowKey ? "Sending..." : "Send SMS"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!overdueRows.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        {t("dashboard.emptyOverdue")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div id="at-risk-list">
          <SectionCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.atRiskTitle")}</h2>
              <Link href="/reports/overdue-rent?days=14&status=active" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {t("dashboard.viewReport")}
              </Link>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
              <span>{t("dashboard.summaryLabel")}</span>
              <span>{formatCurrency(sumRows(atRiskRows))} · {atRiskRows.length} {t("dashboard.summaryTenants")}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">{t("dashboard.table.tenant")}</th>
                    <th className="px-4 py-2">{t("dashboard.table.unit")}</th>
                    <th className="px-4 py-2">{t("dashboard.table.dueDate")}</th>
                    <th className="px-4 py-2">{t("dashboard.table.paidDate")}</th>
                    <th className="px-4 py-2 text-right">{t("dashboard.table.lateMonths")}</th>
                    <th className="px-4 py-2 text-right">{t("dashboard.table.daysLate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskRows.slice(0, 10).map((row) => (
                    <tr key={`${row.propertyId}-${row.unit}-${row.tenant}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-900">
                        <div className="font-semibold">{row.tenant}</div>
                        <div className="text-xs text-slate-500">{row.propertyName || row.propertyId}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{row.dueDate ? formatDate(row.dueDate, locale) : "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.paidDate ? formatDate(row.paidDate, locale) : "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {row.lateMonthsCount ?? 0}/{row.lateMonthsWindow ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.daysOverdue}</td>
                    </tr>
                  ))}
                  {!atRiskRows.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        {t("dashboard.emptyAtRisk")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              {t("dashboard.atRiskRule")}
            </div>
          </SectionCard>
        </div>
      </div>

      <div id="recent-payments">
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.recentPayments")}</h2>
            <Link href="/reports/ledger" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              {t("dashboard.viewReport")}
            </Link>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-600">{t("dashboard.paymentsIn")}</p>
              <div className="mt-3 space-y-3">
                {recentIn.map((txn) => (
                  <div key={`${txn.date}-${txn.description}`} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{txn.description}</p>
                      <p className="text-xs text-slate-500">{formatDate(txn.date, locale)} · {txn.property_id || "—"}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
                {!recentIn.length && (
                  <p className="text-sm text-slate-500">{t("dashboard.emptyRecent")}</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t("dashboard.paymentsOut")}</p>
              <div className="mt-3 space-y-3">
                {recentOut.map((txn) => (
                  <div key={`${txn.date}-${txn.description}`} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{txn.description}</p>
                      <p className="text-xs text-slate-500">{formatDate(txn.date, locale)} · {txn.property_id || "—"}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
                {!recentOut.length && (
                  <p className="text-sm text-slate-500">{t("dashboard.emptyRecent")}</p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  const rounded = roundCurrency(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function sumRows(rows: OverdueRow[]) {
  return rows.reduce((sum, row) => sum + roundCurrency(row.outstandingBalance || 0), 0);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function makeTenantKey(name?: string, unit?: string, property?: string) {
  const parts = [name, unit, property]
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? parts.join("|") : "";
}
