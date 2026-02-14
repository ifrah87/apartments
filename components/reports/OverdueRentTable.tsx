"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OverdueRow } from "@/lib/reports/rentInsights";

type Props = {
  rows: OverdueRow[];
};

type TenantLookup = {
  id?: string;
  name?: string;
  unit?: string;
  property_id?: string;
  building?: string;
};

const DEFAULT_REMINDER =
  "Rent reminder: your payment is overdue. Please pay today or contact management if you need assistance.";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export default function OverdueRentTable({ rows }: Props) {
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [tenantMap, setTenantMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/tenants?ts=" + Date.now())
      .then((res) => res.json())
      .then((payload) => {
        const data: TenantLookup[] = payload?.ok === false ? [] : payload?.ok ? payload.data : payload;
        const map = new Map<string, string>();
        (data || []).forEach((tenant) => {
          const key = buildTenantKey(tenant.name, tenant.unit, tenant.property_id || tenant.building || "");
          if (key && tenant.id) {
            map.set(key, tenant.id);
          }
        });
        setTenantMap(map);
      })
      .catch(() => setTenantMap(new Map()));
  }, []);

  const handleSendReminder = async (row: OverdueRow, rowKey: string) => {
    if (!row.contactPhone) return;
    setSendingKey(rowKey);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: row.contactPhone, body: DEFAULT_REMINDER }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "SMS failed");
      }
      window.alert("Reminder sent.");
    } catch {
      window.alert("Failed to send reminder.");
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Tenant</th>
            <th className="px-4 py-2">Unit</th>
            <th className="px-4 py-2 text-right">Monthly rent</th>
            <th className="px-4 py-2">Last payment</th>
            <th className="px-4 py-2 text-right">Outstanding balance</th>
            <th className="px-4 py-2">Days overdue</th>
            <th className="px-4 py-2">Contact</th>
            <th className="px-4 py-2">Notes</th>
            <th className="px-4 py-2 text-right">Reminder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowKey = `${row.propertyId}-${row.unit}-${row.tenant}`;
            const canSend = Boolean(row.contactPhone);
            const tenantId = tenantMap.get(buildTenantKey(row.tenant, row.unit, row.propertyId || row.propertyName || ""));
            return (
              <tr key={rowKey} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-900">
                  <div className="font-semibold">
                    {tenantId ? (
                      <Link href={`/tenants/${tenantId}?tab=statement`} className="text-indigo-600 hover:underline">
                        {row.tenant}
                      </Link>
                    ) : (
                      row.tenant
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{row.propertyName}</div>
                </td>
                <td className="px-4 py-2 text-slate-700">{row.unit}</td>
                <td className="px-4 py-2 text-right text-slate-900">{formatMoney(row.monthlyRent)}</td>
                <td className="px-4 py-2 text-slate-600">
                  {row.lastPaymentDate
                    ? `${formatDate(row.lastPaymentDate)} · ${formatMoney(row.lastPaymentAmount || 0)}`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-rose-600">
                  {formatMoney(row.outstandingBalance)}
                </td>
                <td className="px-4 py-2 text-slate-600">{row.daysOverdue} days</td>
                <td className="px-4 py-2 text-slate-600">
                  <div>{row.contactPhone}</div>
                  <div className="text-xs text-slate-400">{row.contactEmail}</div>
                </td>
                <td className="px-4 py-2 text-slate-600">{row.notes}</td>
                <td className="px-4 py-2 text-right">
                  {canSend ? (
                    <button
                      type="button"
                      onClick={() => handleSendReminder(row, rowKey)}
                      disabled={sendingKey === rowKey}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingKey === rowKey ? "Sending..." : "Send reminder"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No overdue tenants matching the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function buildTenantKey(name?: string, unit?: string, property?: string) {
  return [name, unit, property]
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}
