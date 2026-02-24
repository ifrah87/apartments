"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PropertySummary } from "@/lib/repos/propertiesRepo";

type Props = {
  summaries: PropertySummary[];
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number) {
  return currency.format(value || 0);
}

export default function PropertiesClient({ summaries }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((summary) => {
      const name = summary.name.toLowerCase();
      const code = (summary.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [query, summaries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Overview, units, and tenants per building."
      />

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-panel/60 px-4 py-3 text-sm text-slate-400">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search building, unit, or tenant"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-400">{summaries.length} properties loaded</p>
        </div>
      </SectionCard>

      <div className="space-y-4">
        {filtered.map((summary) => (
          <SectionCard key={summary.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{summary.name}</h2>
                <p className="text-xs text-slate-400">
                  {summary.totalUnits} units • {summary.occupiedUnits} occupied • {summary.vacantUnits} vacant
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/properties/${summary.id}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Overview
                </Link>
                <Link
                  href={`/units?propertyId=${encodeURIComponent(summary.id)}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Units
                </Link>
                <Link
                  href={`/tenants?propertyId=${encodeURIComponent(summary.id)}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Tenants
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total Units</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.totalUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Occupied</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.occupiedUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Vacant</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{summary.vacantUnits}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-panel/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Monthly Rent</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{formatMoney(summary.monthlyRent)}</p>
              </div>
            </div>
          </SectionCard>
        ))}

        {!filtered.length && (
          <SectionCard className="p-6 text-center text-sm text-slate-400">
            No properties match your search.
          </SectionCard>
        )}
      </div>
    </div>
  );
}
