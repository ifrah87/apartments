"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusChip from "@/components/ui/StatusChip";
import type { LeaseCommercial, OnboardingCheckpointsCommercial, TenantOrg } from "@/lib/commercial";

type OrgRow = {
  org: TenantOrg;
  lease?: LeaseCommercial;
  checkpoints?: OnboardingCheckpointsCommercial;
  missing: string[];
};

export default function TenantOrgsPage() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tenant-orgs/onboarding", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const deleteOnboarding = async (orgId: string) => {
    if (deletingId) return;
    if (!window.confirm("Delete this onboarding record? This cannot be undone.")) return;
    setDeletingId(orgId);
    const res = await fetch(`/api/admin/tenant-orgs/${orgId}/onboarding`, { method: "DELETE" });
    const response = await res.json().catch(() => ({}));
    if (!res.ok || !response?.ok) {
      alert(response?.error || "Delete failed.");
      setDeletingId(null);
      return;
    }
    setRows((prev) => prev.filter((row) => row.org.id !== orgId));
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Company tenants</h1>
          <p className="text-sm text-slate-500">Manage commercial tenant organizations and onboarding progress.</p>
        </div>
        <Link
          href="/admin/tenants/onboarding/new"
          className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Start onboarding
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
            {rows.map((row) => (
              <tr key={row.org.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{row.org.name}</div>
                  <div className="text-xs text-slate-500">{row.org.billingEmail}</div>
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
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/tenants/onboarding/${row.org.id}`}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteOnboarding(row.org.id)}
                      disabled={deletingId === row.org.id}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      {deletingId === row.org.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No tenant organizations yet.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Loading tenant organizations...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
