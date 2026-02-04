"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  Users,
  UserPlus,
  Gauge,
  Receipt,
  BarChart3,
  Plug,
  BookUser,
  Shield,
  Wrench,
} from "lucide-react";
import { SidebarBrand } from "./SidebarBrand";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/tenants/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/readings", label: "Readings", icon: Gauge },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/contacts", label: "Contacts", icon: BookUser },
  { href: "/admin", label: "Admin", icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-40 h-screen w-[260px] shrink-0 border-r border-white/10 bg-gradient-to-b from-[#0b1220] via-[#0b1324] to-[#0a0f1d] text-slate-200 shadow-[0_10px_40px_rgba(2,6,23,0.45)]">
      <div className="border-b border-white/10">
        <SidebarBrand />
      </div>
      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-accent bg-gradient-to-r from-accent/15 via-accent/5 to-transparent text-white shadow-card-glow"
                  : "border-transparent text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-slate-200">
                <Icon className="h-5 w-5" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
