"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  Users,
  LineChart,
  Wrench,
  Banknote,
  FileBarChart2,
  PlugZap,
  UserCircle,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/sky-cafe", label: "Commercial & Café", icon: LineChart },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/accounting", label: "Accounting", icon: Banknote },
  { href: "/reports", label: "Reports & Analytics", icon: FileBarChart2 },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/contacts", label: "Contacts", icon: UserCircle },
];

export default function Sidebar({ bankStatus }: { bankStatus?: { last: string } }) {
  const pathname = usePathname();

  return (
    <aside
      className="group fixed left-0 top-0 h-screen w-20 hover:w-64 bg-[#0B1530] border-r border-slate-800 shadow-sm transition-all duration-300 ease-in-out overflow-hidden"
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          {/* Logo + name */}
          <div className="px-4 pt-6">
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0B1530] ring-2 ring-[#D4AF37]/80 shadow-lg shadow-black/40">
                <Image
                  src="/branding/logo.png"
                  alt="Orfane Real Estate"
                  width={40}
                  height={40}
                  className="h-8 w-8 object-contain"
                  priority
                />
              </div>
              <span className="text-lg font-semibold text-[#E5C76B] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                Orfane Real Estate
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1 mt-6">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom section (bank data) */}
        <div className="border-t border-slate-700 px-4 py-4 text-xs text-slate-400">
          <div className="font-medium text-[#D4AF37]">Bank data</div>
          <div>Last updated {bankStatus?.last ?? "—"}</div>
        </div>
      </div>
    </aside>
  );
}
