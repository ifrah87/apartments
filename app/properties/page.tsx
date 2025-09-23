"use client";

import Link from "next/link";
import { useState } from "react";

const TABS = [
  { key: "all", label: "All", count: 1 },
  { key: "overdue", label: "Rent overdue", count: 0 },
  { key: "soon", label: "Rent due soon", count: 0 },
  { key: "later", label: "Rent due later", count: 0 },
  { key: "vacant", label: "Vacant", count: 1 },
  { key: "multi", label: "Multi-Unit", count: 0 },
];

export default function PropertiesPage() {
  const [active, setActive] = useState("all");

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-semibold">Properties</h1>

      {/* Tabs + Search + Add button */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap gap-3 text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`px-3 py-1 rounded-lg border transition ${
                active === tab.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs text-slate-500">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Right side: search + add */}
        <div className="flex w-full items-center justify-start gap-3 md:w-auto md:justify-end">
          <input
            type="text"
            placeholder="Search address or tenants"
            className="w-full md:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Link
            href="/properties/new"
            className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            + Add property
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-600">Address</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-600">Tenants</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-600">Due Date</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-600">Rent Due</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-2">Taleex district</td>
              <td className="px-4 py-2">Vacant</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">VACANT</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
