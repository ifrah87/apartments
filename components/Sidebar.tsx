"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users2,
  Store,
  Coffee,
  Wrench,
  Banknote,
  BarChart2,
  Plug,
  BookUser,
  ChevronDown,
  HelpCircle,
  Ellipsis,
} from "lucide-react";

/* ---------- Types + helpers ---------- */
type Leaf = { kind: "leaf"; label: string; href: string; icon: React.ElementType };
type Group = { kind: "group"; label: string; icon: React.ElementType; children: Leaf[] };
type Item = Leaf | Group;
const isGroup = (i: Item): i is Group => "children" in (i as Group);

/* ---------- Nav items ---------- */
const NAV: Item[] = [
  { kind: "leaf", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { kind: "leaf", label: "Properties", href: "/properties", icon: Building2 },
  { kind: "leaf", label: "Tenants", href: "/tenants", icon: Users2 },
  { kind: "leaf", label: "Commercial Space", href: "/commercial-space", icon: Store },
  { kind: "leaf", label: "Sky Cafe", href: "/sky-cafe", icon: Coffee },
  { kind: "leaf", label: "Maintenance", href: "/maintenance", icon: Wrench },
  { kind: "leaf", label: "Accounting", href: "/accounting", icon: Banknote },
  { kind: "leaf", label: "Reports & Analytics", href: "/reports", icon: BarChart2 },
  { kind: "leaf", label: "Integrations", href: "/integrations", icon: Plug },
  {
    kind: "group",
    label: "Contacts",
    icon: BookUser,
    children: [
      { kind: "leaf", label: "Tenants", href: "/contacts/tenants", icon: BookUser },
      { kind: "leaf", label: "Owners", href: "/contacts/owners", icon: BookUser },
      { kind: "leaf", label: "Suppliers", href: "/contacts/suppliers", icon: BookUser },
    ],
  },
  { kind: "leaf", label: "More", href: "/more", icon: Ellipsis },
  { kind: "leaf", label: "Help Centre", href: "/help", icon: HelpCircle },
];

/* ---------- Component ---------- */
export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false); // click-to-pin
  const [open, setOpen] = useState<Record<string, boolean>>({
    Contacts: true, // or false if you want it collapsed initially
  });

  return (
    <aside
      className={`group fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-slate-200 bg-white md:flex
        overflow-hidden transition-all duration-300
        ${expanded ? "w-64" : "w-16 hover:w-64"}`}
      onMouseLeave={() => setExpanded((p) => (p ? p : false))}
    >
      {/* Brand + pin toggle */}
      <div className="flex h-20 items-center gap-2 px-4">
        <div className="relative h-8 w-10">
          <Image src="/taleex-logo.png" alt="Taleex logo" fill className="object-contain" priority />
        </div>

        <div
          className={`text-xs font-semibold tracking-wide text-slate-700
            ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity duration-200`}
        >
          TALEEX
          <br />
          APARTMENTS
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse sidebar" : "Pin sidebar open"}
          className={`ml-auto rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600
            ${expanded ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
        >
          {expanded ? "Unpin" : "Pin"}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {NAV.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition 
                  ${active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {active && <span className="absolute inset-y-0 left-0 w-1.5 rounded-r bg-emerald-400" />}
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg
                    ${active ? "bg-slate-200" : "bg-slate-100 text-slate-500 group-hover/item:text-slate-700"}`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span
                  className={`truncate transition-opacity duration-150
                    ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          // Groups (e.g., Contacts)
          const isOpen = open[item.label] ?? false;
          const groupActive = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
          );

          return (
            <div key={item.label}>
              {/* Header row with toggle */}
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [item.label]: !isOpen }))}
                aria-expanded={isOpen}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm
                  ${groupActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-lg
                      ${groupActive ? "bg-slate-200" : "bg-slate-100 text-slate-500"}`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                  >
                    {item.label}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform
                    ${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                    ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Children: visible when isOpen; in collapsed mode they show on hover */}
              <div
                className={`mt-1 space-y-1 pl-10 ${
                  isOpen ? (expanded ? "block" : "hidden group-hover:block") : "hidden"
                }`}
              >
                {item.children.map((c) => {
                  const active = pathname === c.href || pathname.startsWith(c.href + "/");
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      aria-label={c.label}
                      className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition
                        ${active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-1.5 rounded-r bg-emerald-400" />}
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover/item:text-slate-700">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span
                        className={`${expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                      >
                        {c.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer card */}
      <div
        className={`${
          expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } border-t border-slate-200 px-3 py-3 transition-opacity`}
      >
        <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500">
          <div className="font-medium text-slate-700">Bank data</div>
          <div className="mt-1">Last updated 2m ago</div>
        </div>
      </div>
    </aside>
  );
}
