"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Building2,
  FileText,
  Users2,
  Plug,
  Wrench,
  BookUser,
  HelpCircle,
  Ellipsis,
  ChevronDown,
  Store,
  Coffee,
} from "lucide-react";

/* ---------- Types & helpers ---------- */
type Leaf = { kind: "leaf"; label: string; href: string; icon: React.ElementType };
type Group = { kind: "group"; label: string; icon: React.ElementType; children: Leaf[] };
type Item = Leaf | Group;
const isGroup = (i: Item): i is Group => "children" in (i as Group);

/* small round badge behind the icon */
function IconBadge({ Icon, active }: { Icon: React.ElementType; active: boolean }) {
  return (
    <span
      className={`grid h-6 w-6 place-items-center rounded-full ${
       - active ? "bg-white-500/90 text-blue" : "bg-white/10 text-slate-200"
       + active ? "bg-white-500/90 text-white" : "bg-white/10 text-slate-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function LeafLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition
        ${active ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5 hover:text-white"}`}
    >
      {active && <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-emerald-400" />}
      <IconBadge Icon={Icon} active={active} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* ---------- Nav (no “Organisation”) ---------- */
const NAV: Item[] = [
  { kind: "leaf", label: "Dashboard", href: "/dashboard", icon: Home },
  { kind: "leaf", label: "Properties", href: "/properties", icon: Building2 },
  { kind: "leaf", label: "Reports", href: "/reports", icon: FileText },
  { kind: "leaf", label: "Commercial Space", href: "/commercial Space", icon: Store},
  { kind: "leaf", label: "Sky Cafe", href: "/skycafe", icon: Coffee},
  {
    kind: "group",
    label: "Find Tenants",
    icon: Users2,
    children: [
      { kind: "leaf", label: "Tenants", href: "/tenants", icon: Users2 },
      { kind: "leaf", label: "Prospective", href: "/tenants/prospective", icon: Users2 },
    ],
  },
  { kind: "leaf", label: "Integrations", href: "/integrations", icon: Plug },
  { kind: "leaf", label: "Maintenance", href: "/maintenance", icon: Wrench },
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
export default function SidebarLS() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({
    "Find Tenants": true,
    Contacts: true,
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-55 flex-col bg-[#0d3978] text-white md:flex">


    {/* Brand row: BIG logo only */}
<div className="flex h-36 items-center justify-center border-b border-white/10 px-4">
  <div className="relative h-28 w-48">
    <Image
      src="/taleex-logo.png"
      alt="Taleex logo"
      fill
      className="object-contain scale-165"  // bump to 175/200 if needed
      priority
    />
  </div>
</div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {NAV.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <LeafLink
                key={item.label}
                href={item.href}
                label={item.label}
                Icon={item.icon}
                active={active}
              />
            );
          }

          const groupActive = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
          );
          const isOpen = open[item.label] ?? true;

          return (
            <div key={item.label} className="select-none">
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [item.label]: !isOpen }))}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm
                  ${groupActive ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="flex items-center gap-3">
                  <IconBadge Icon={item.icon} active={groupActive} />
                  {item.label}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="mt-1 space-y-1 pl-8">
                  {item.children.map((c) => {
                    const active = pathname === c.href || pathname.startsWith(c.href + "/");
                    return (
                      <LeafLink
                        key={c.href}
                        href={c.href}
                        label={c.label}
                        Icon={c.icon}
                        active={active}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3 text-xs text-slate-300">
        © {new Date().getFullYear()} Orfane
      </div>
    </aside>
  );
}

