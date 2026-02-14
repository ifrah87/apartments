"use client";

import Link from "next/link";
import React from "react";

type Props = {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  span?: number;
  href?: string;
  accent?: "cyan" | "orange" | "purple" | "green" | "red";
  className?: string;
};

export default function StatCard({ label, value, subtitle, span, href, accent: _accent = "cyan", className = "" }: Props) {
  const accentClass = "border-l-accent/80";
  const card = (
    <div
      className={`
        relative overflow-hidden rounded-2xl border border-white/10 bg-panel/80 bg-gradient-to-br from-white/5 to-transparent
        p-6 shadow-card-soft transition-all duration-300 ease-in-out
        hover:-translate-y-0.5 hover:border-white/20 hover:shadow-card-glow
        flex flex-col justify-between gap-2 border-l-4 ${accentClass}
        ${span ? `col-span-${span}` : ""} ${href ? "cursor-pointer" : ""} ${className}
      `}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <h2 className="text-3xl font-semibold text-slate-100">{value}</h2>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {card}
      </Link>
    );
  }

  return card;
}
