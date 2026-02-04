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
    <div className="rounded-2xl border border-white/10 bg-surface/80 p-6 shadow-card-soft backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cash in and out</p>
          <div className="mt-3 flex gap-6 text-xl font-semibold text-slate-100">
            <div>
              <div className="text-[11px] uppercase text-slate-400">Cash in</div>
              ${formatNumber(totals.in)}
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400">Cash out</div>
              ${formatNumber(totals.out)}
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400">Difference</div>
              ${formatNumber(totals.in - totals.out)}
            </div>
          </div>
        </div>
        <div className="flex gap-2 rounded-full border border-white/10 bg-surface/70 p-1 text-sm font-medium text-slate-300">
          {(["monthly", "quarterly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-full px-3 py-1 transition ${
                range === option ? "bg-white/10 text-slate-100 shadow-sm" : "hover:text-white"
              }`}
            >
              {option === "monthly" ? "Monthly" : option === "quarterly" ? "Quarterly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex h-72 items-end gap-4 rounded-2xl bg-gradient-to-b from-white/5 to-transparent px-6 py-8">
        {displayPoints.map((point, idx) => (
          <div
            key={point.key}
            className="relative flex w-24 flex-col items-center gap-2 text-xs text-slate-400"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex h-44 w-full items-end gap-3">
              <div
                className="w-5 rounded-sm bg-cyan-400 shadow-[0_2px_6px_rgba(34,211,238,0.35)]"
                style={{ height: `${Math.max((point.inflow / maxValue) * 100, 4)}%` }}
              />
              <div
                className="w-5 rounded-sm bg-slate-600/70 shadow-[0_2px_6px_rgba(15,23,42,0.5)]"
                style={{ height: `${Math.max((Math.abs(point.outflow) / maxValue) * 100, 4)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-300">{point.label}</span>
            {hoveredIndex === idx && (
              <div className="absolute -top-32 left-1/2 w-48 -translate-x-1/2 rounded-2xl border border-white/10 bg-surface/95 p-4 text-xs shadow-lg">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{point.label}</p>
                <div className="mt-2 flex justify-between text-slate-100">
                  <span>In</span>
                  <strong>${formatNumber(point.inflow)}</strong>
                </div>
                <div className="flex justify-between text-slate-100">
                  <span>Out</span>
                  <strong>${formatNumber(Math.abs(point.outflow))}</strong>
                </div>
                <div className="flex justify-between text-slate-100">
                  <span>Diff</span>
                  <strong>${formatNumber(point.inflow - Math.abs(point.outflow))}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          Cash in
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-600/70" />
          Cash out
        </span>
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          href={link}
          className="rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:border-cyan-300/60"
        >
          View detailed cashflow →
        </Link>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}
