"use client";

import { useMemo } from "react";

function monthMatrix(d: Date) {
  const year = d.getFullYear();
  const month = d.getMonth(); // 0–11
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = (first.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = last.getDate();

  const cells: { day: number | null; isToday: boolean }[] = [];
  // leading blanks
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, isToday: false });
  // days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday =
      year === new Date().getFullYear() &&
      month === new Date().getMonth() &&
      d === new Date().getDate();
    cells.push({ day: d, isToday });
  }
  // pad to full weeks (42 = 6 rows * 7 cols)
  while (cells.length < 42) cells.push({ day: null, isToday: false });

  return cells;
}

export default function CalendarMini() {
  const now = useMemo(() => new Date(), []);
  const label = now.toLocaleString("default", { month: "long", year: "numeric" });
  const cells = monthMatrix(now);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="select-none">
      {/* Header (label already rendered by your SectionTitle) */}
      <div className="grid grid-cols-7 gap-1 text-xs text-slate-500">
        {weekdays.map((w) => (
          <div key={w} className="py-1 text-center">{w}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`aspect-square rounded-lg border text-sm flex items-center justify-center
              ${c.day
                ? c.isToday
                  ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
                : "border-transparent bg-transparent"}
            `}
            aria-label={c.day ? `${label} ${c.day}` : undefined}
          >
            {c.day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
