"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/tenant-org/dashboard", label: "Dashboard" },
  { href: "/tenant-org/invoices", label: "Invoices" },
  { href: "/tenant-org/documents", label: "Documents" },
  { href: "/tenant-org/facilities", label: "Facilities" },
  { href: "/tenant-org/notices", label: "Notices" },
  { href: "/tenant-org/profile", label: "Profile" },
];

export default function TenantOrgNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
