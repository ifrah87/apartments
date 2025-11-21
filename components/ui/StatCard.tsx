"use client";

import Link from "next/link";
import React from "react";

type Props = {
  label: string;
  value: string | number;
  subtitle?: string;
  span?: number;
  href?: string;
};

export default function StatCard({ label, value, subtitle, span, href }: Props) {
  const card = (
    <div
      className={`
        rounded-2xl border border-slate-200 bg-white
        p-5 shadow-sm transition-all duration-300 ease-in-out
        hover:shadow-lg hover:border-indigo-200 hover:-translate-y-1
        flex flex-col justify-between
        ${span ? `col-span-${span}` : ""}
        ${href ? "cursor-pointer" : ""}
      `}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-800">{value}</h2>
      {subtitle && <p className="mt-1 text-xs text-slate-400 italic">{subtitle}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded-2xl">
        {card}
      </Link>
    );
  }

  return card;
}
