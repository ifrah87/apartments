"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  Building2,
  Users,
  Coffee,
  Wrench,
  Banknote,
  BarChart2,
  Plug,
  BookUser,
  Ellipsis,
} from "lucide-react";
import logo from "@/public/branding/logo-v3-trim.png";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/sky-cafe", label: "Commercial Space", icon: Coffee },
  //{ href: "/maintenance", label: "Maintenance", icon: Wrench },
  //{ href: "/accounting", label: "Accounting", icon: Banknote },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/contacts", label: "Contacts", icon: BookUser },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);
  const widthClass = pinned ? "w-64" : "w-20 hover:w-64";
  const textVisibility = pinned ? "opacity-100" : "opacity-0 group-hover:opacity-50";
  const logoSize = pinned ? "h-48 w-28" : "h-24 w-24 group-hover:h-20 group-hover:w-32";

  return (
    <aside
      data-pinned={pinned}
      className={`group sticky top-0 z-40 h-screen shrink-0 ${widthClass} border-r border-[#1f2a44] bg-gradient-to-br from-[#050a16] via-[#050911] to-[#020308] text-white shadow-xl transition-all duration-300 relative`}
    >
      <button
        type="button"
        aria-label={pinned ? "Collapse sidebar" : "Expand sidebar"}
        onClick={() => setPinned((prev) => !prev)}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#050a16]/80 p-2 text-white/70 shadow-lg hover:bg-white/10"
      >
        <Ellipsis className="h-5 w-5" />
      </button>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex flex-col items-center px-3 pt-8">
            <div className={`relative shrink-0 transition-all duration-300 ${logoSize}`}>
              <Image
                src={logo}
                alt="Orfane's Real Estate"
                fill
                className="object-contain mix-blend-screen drop-shadow-[0_0_35px_rgba(245,230,191,0.45)]"
                style={{ filter: "brightness(1.35) saturate(1.05)" }}
                priority
              />
            </div>
          </div>

          <nav className="mt-12 flex flex-col gap-2 px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-3 text-base transition ${
                    active
                      ? "bg-white/10 text-[#f5e6bf]"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`truncate text-[15px] font-semibold transition-opacity duration-200 ${textVisibility}`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 px-3 py-4 text-xs text-white/60">
          <div className={`space-y-1 transition-opacity ${textVisibility}`}>
            <p>Bank sync:</p>
            <p className="font-semibold text-[#f5e6bf]">Updated 2m ago</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
