"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Home, Gauge, Receipt, BarChart3, Wrench, FileText, Settings, Landmark } from "lucide-react";
import { SidebarBrand } from "./SidebarBrand";
import { useTranslations } from "@/components/LanguageProvider";

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof LayoutGrid;
  indent?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "sidebar.nav.dashboard", icon: LayoutGrid },
  { href: "/properties", labelKey: "sidebar.nav.properties", icon: Building2 },
  { href: "/units", labelKey: "sidebar.nav.units", icon: Home },
  // Tenants/Onboarding removed from main nav
  { href: "/readings", labelKey: "sidebar.nav.readings", icon: Gauge },
  { href: "/bills", labelKey: "sidebar.nav.bills", icon: Receipt },
  { href: "/reports/bank-reconciliation", labelKey: "sidebar.nav.bank", icon: Landmark },
  { href: "/leases", labelKey: "sidebar.nav.leases", icon: FileText },
  { href: "/services", labelKey: "sidebar.nav.services", icon: Wrench },
  { href: "/reports", labelKey: "sidebar.nav.reports", icon: BarChart3 },
  { href: "/settings", labelKey: "sidebar.nav.settings", icon: Settings },
];

export default function Sidebar({
  className = "",
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <aside className={`sticky top-0 z-40 w-64 shrink-0 flex-col border-r border-white/10 bg-app-surface text-slate-200 lg:w-72 ${className}`}>
      <div className="pt-0">
        <SidebarBrand />
        <div className="mx-5 mt-1 h-px bg-white/5" />
      </div>
      <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-4 pt-1" aria-label="Primary">
        {NAV.map(({ href, labelKey, icon: Icon, indent }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          const paddingClass = indent ? "pl-10" : "pl-3";
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 ${paddingClass} text-base font-medium transition ${
                active
                  ? "bg-accent/15 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  active ? "bg-accent/20 text-accent" : "text-slate-400 group-hover:text-slate-200"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
