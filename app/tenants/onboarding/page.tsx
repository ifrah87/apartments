"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusChip from "@/components/ui/StatusChip";
import type { LeaseCommercial, OnboardingCheckpointsCommercial, TenantOrg } from "@/lib/commercial";

type OnboardingRow = {
  org: TenantOrg;
  lease?: LeaseCommercial;
  checkpoints?: OnboardingCheckpointsCommercial;
  missing: string[];
};

export default function TenantsOnboardingListPage() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tenant-orgs/onboarding", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const onboardingRows = rows.filter((row) => row.org?.status !== "active");
  const archivedRows = rows.filter((row) => row.org?.status === "active");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Company Onboarding</h1>
          <p className="text-sm text-slate-500">Guide each company through setup, approvals, and activation.</p>
        </div>
        <Link
          href="/tenants/onboarding/new"
          className="inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Start onboarding
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Active onboarding</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{onboardingRows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Archived</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{archivedRows.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline</p>
              <p className="text-lg font-semibold text-slate-900">Onboarding</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {onboardingRows.length} active
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Missing</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {onboardingRows.map((row) => (
                <tr key={row.org.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.org.name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.org.unitIds?.join(", ") || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={row.org.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.missing?.length ? (
                        row.missing.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">All set</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenants/onboarding/${row.org.id}`}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                    >
                      Continue
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !onboardingRows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No onboarding records yet.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading onboarding list...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">History</p>
              <p className="text-lg font-semibold text-slate-900">Archive</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {archivedRows.length} completed
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {archivedRows.map((row) => (
                <tr key={row.org.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.org.name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.org.unitIds?.join(", ") || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={row.org.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenants/onboarding/${row.org.id}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !archivedRows.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                    No archived tenants yet.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading archive...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
