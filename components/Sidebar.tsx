"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Home, Gauge, Receipt, BarChart3, Wrench, FileText, Settings } from "lucide-react";
import { SidebarBrand } from "./SidebarBrand";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/units", label: "Units", icon: Home },
  // Tenants/Onboarding removed from main nav
  { href: "/readings", label: "Readings", icon: Gauge },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 z-40 flex h-[calc(100vh-1rem)] w-64 shrink-0 flex-col border-r border-white/10 bg-app-surface text-slate-200 shadow-[0_10px_40px_rgba(2,6,23,0.45)]">
      <div className="-mt-2">
        <SidebarBrand />
        <div className="mx-4 mt-0 h-px bg-white/5" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon, indent }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          const paddingClass = indent ? "pl-11" : "pl-9";
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-2 rounded-full px-2.5 py-2 ${paddingClass} text-sm font-medium transition ${
                active
                  ? "bg-accent/15 text-white shadow-card-glow"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span
                className={`absolute left-3 top-1/2 h-2.5 w-1.5 -translate-y-1/2 rounded-full ${
                  active ? "bg-accent shadow-[0_0_12px_rgba(56,189,248,0.45)]" : "bg-transparent"
                }`}
              />
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  active ? "bg-accent/15 text-accent" : "bg-white/5 text-slate-300 group-hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
