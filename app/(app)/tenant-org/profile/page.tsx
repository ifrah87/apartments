"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { TenantOrg } from "@/lib/commercial";

export default function TenantOrgProfilePage() {
  const [org, setOrg] = useState<TenantOrg | null>(null);

  useEffect(() => {
    fetch("/api/tenant-org/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.org) return;
        setOrg(data.org);
      })
      .catch(() => setOrg(null));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Company profile</h1>
        <p className="text-sm text-slate-500">Review your company and contact details.</p>
      </header>

      <SectionCard className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Company</p>
            <p className="text-sm font-semibold text-slate-900">{org?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Billing email</p>
            <p className="text-sm font-semibold text-slate-900">{org?.billingEmail || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Property</p>
            <p className="text-sm font-semibold text-slate-900">{org?.propertyId || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Units</p>
            <p className="text-sm font-semibold text-slate-900">{org?.unitIds?.join(", ") || "-"}</p>
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
