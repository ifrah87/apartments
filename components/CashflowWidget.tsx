"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Range = "monthly" | "quarterly" | "yearly";

export type CashflowPoint = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  monthIndex: number;
};

type Props = {
  points: CashflowPoint[];
  link: string;
};

export default function CashflowWidget({ points, link }: Props) {
  const [range, setRange] = useState<Range>("monthly");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayPoints = useMemo(() => {
    if (range === "monthly") return points;
    if (range === "quarterly") {
      const grouped: CashflowPoint[] = [];
      for (let i = 0; i < points.length; i += 3) {
        const slice = points.slice(i, i + 3);
        if (!slice.length) continue;
        grouped.push({
          key: `Q${grouped.length}`,
          label: `${slice[0].label}–${slice[slice.length - 1].label}`,
          inflow: slice.reduce((sum, p) => sum + p.inflow, 0),
          outflow: slice.reduce((sum, p) => sum + p.outflow, 0),
          monthIndex: slice[0].monthIndex,
        });
      }
      return grouped;
    }
    return [
      {
        key: "year",
        label: "Last 12 months",
        inflow: points.reduce((sum, p) => sum + p.inflow, 0),
        outflow: points.reduce((sum, p) => sum + p.outflow, 0),
        monthIndex: points[0]?.monthIndex ?? 0,
      },
    ];
  }, [points, range]);

  const totals = useMemo(() => {
    return {
      in: displayPoints.reduce((sum, p) => sum + p.inflow, 0),
      out: displayPoints.reduce((sum, p) => sum + Math.abs(p.outflow), 0),
    };
  }, [displayPoints]);

  const maxValue = Math.max(
    ...displayPoints.map((p) => Math.max(p.inflow, Math.abs(p.outflow))),
    1,
  );

  const activePoint = hoveredIndex != null ? displayPoints[hoveredIndex] : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600">Cash in and out</p>
          <div className="mt-2 flex gap-6 text-xl font-semibold text-slate-900">
            <div>
              <div className="text-xs uppercase text-slate-500">Cash in</div>
              ${formatNumber(totals.in)}
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Cash out</div>
              ${formatNumber(totals.out)}
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Difference</div>
              ${formatNumber(totals.in - totals.out)}
            </div>
          </div>
        </div>
        <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-500">
          {(["monthly", "quarterly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-full px-3 py-1 ${
                range === option ? "bg-white text-slate-900 shadow-sm" : ""
              }`}
            >
              {option === "monthly" ? "Monthly" : option === "quarterly" ? "Quarterly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex h-72 items-end gap-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white px-6 py-8">
        {displayPoints.map((point, idx) => (
          <div
            key={point.key}
            className="relative flex w-24 flex-col items-center gap-2 text-xs text-slate-500"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex h-44 w-full items-end gap-3">
              <div
                className="w-5 rounded-sm bg-[#4a92ff] shadow-[0_2px_6px_rgba(74,146,255,0.25)]"
                style={{ height: `${Math.max((point.inflow / maxValue) * 100, 4)}%` }}
              />
              <div
                className="w-5 rounded-sm bg-slate-300 shadow-[0_2px_6px_rgba(148,163,184,0.4)]"
                style={{ height: `${Math.max((Math.abs(point.outflow) / maxValue) * 100, 4)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-600">{point.label}</span>
            {hoveredIndex === idx && (
              <div className="absolute -top-32 left-1/2 w-48 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-4 text-xs shadow-lg">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{point.label}</p>
                <div className="mt-2 flex justify-between text-slate-700">
                  <span>In</span>
                  <strong>${formatNumber(point.inflow)}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Out</span>
                  <strong>${formatNumber(Math.abs(point.outflow))}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Diff</span>
                  <strong>${formatNumber(point.inflow - Math.abs(point.outflow))}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#4a92ff]" />
          Cash in
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          Cash out
        </span>
      </div>
      <div className="mt-4 flex justify-end">
        <Link href={link} className="rounded-full border border-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:border-indigo-200">
          View detailed cashflow →
        </Link>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}
