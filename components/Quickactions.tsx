"use client";
import Link from "next/link";

export default function QuickActions() {
  const items = [
    { label: "New Tenant", href: "/tenants/new" },
    { label: "Add Payment", href: "/payments/new" },
    { label: "Upload Statement", href: "/uploads/bank" },
    { label: "New Property", href: "/properties/new" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 text-sm font-medium text-slate-700">Quick actions</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
