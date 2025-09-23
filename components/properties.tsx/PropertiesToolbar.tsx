"use client";

import { useState } from "react";

const TABS= [
    {Key: "all", label: "All", count: 1},
    { key: "overdue", label: "Rent overdue", count: 0 },
    { key: "dueSoon", label: "Rent due soon", count: 0 },
    { key: "dueLater", label: "Rent due later", count: 0 },
    { key: "vacant", label: "Vacant", count: 1 },
    { key: "multi", label: "Multi-Unit", count: 0 },
];

export default function PropertiesToolbar() {
    const [active, setActive]= useState("all");

    return (
            <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-6 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`relative pb-2 ${
              active === t.key
                ? "font-semibold text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}{" "}
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
              {t.count}
            </span>
            {active === t.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-sky-500" />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          placeholder="Search address or tenants"
          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 md:max-w-md"
        />
      </div>
    </div>
  );
}
