"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  CalendarClock,
  ScrollText,
  KeyRound,
  Users2,
  Wrench,
  Truck,
  LineChart,
  Wallet,
  Zap,
  Scale,
  BookOpen,
  Calculator,
  NotebookPen,
  ListOrdered,
  Search,
  Star,
} from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type ReportTileItem = { name: string; desc: string; href: string; Icon: React.ElementType };

const REPORT_GROUPS: { title: string; items: ReportTileItem[] }[] = [
  {
    title: "Banking",
    items: [
      { name: "Bank Summary", desc: "Cash in/out overview", href: "/reports/bank-summary", Icon: Wallet },
      { name: "Account Transactions", desc: "Full ledger export", href: "/reports/account-transactions", Icon: LineChart },
      { name: "Profit & Loss", desc: "Income vs expense per property.", href: "/reports/pnl", Icon: CircleDollarSign },
      { name: "Bank Imports", desc: "Matched vs unmatched statements.", href: "/reports/bank-import-summary", Icon: LineChart },
      { name: "Bank Reconciliation", desc: "Book balance vs bank balance.", href: "/reports/bank-reconciliation", Icon: Wallet },
    ],
  },
  {
    title: "Accounting",
    items: [
      { name: "Balance Sheet", desc: "Assets vs liabilities snapshot.", href: "/reports/balance-sheet", Icon: Scale },
      { name: "Cashflow", desc: "Movement of cash by activity.", href: "/reports/cashflow", Icon: CircleDollarSign },
      { name: "Trial Balance", desc: "Debits vs credits per account.", href: "/reports/trial-balance", Icon: Calculator },
      { name: "General Ledger", desc: "Account-by-account journal.", href: "/reports/general-ledger", Icon: BookOpen },
      { name: "Journal Entries", desc: "Posted entries & adjustments.", href: "/reports/journal-entries", Icon: NotebookPen },
      { name: "Chart of Accounts", desc: "Account reference list.", href: "/reports/chart-of-accounts", Icon: ListOrdered },
    ],
  },
  {
    title: "Rent Payments",
    items: [
      { name: "Rent Roll", desc: "Live rent vs payments snapshot.", href: "/reports/rent-roll", Icon: ScrollText },
      { name: "Rent Ledger", desc: "Payments received vs due.", href: "/reports/ledger", Icon: CircleDollarSign },
      { name: "Overdue Rent", desc: "Delinquent tenants & arrears.", href: "/reports/overdue-rent", Icon: CalendarClock },
      { name: "Rent Charges", desc: "Scheduled adjustments.", href: "/reports/rent-charges", Icon: ScrollText },
      { name: "Deposits", desc: "Balances held vs released.", href: "/reports/deposits", Icon: ScrollText },
    ],
  },
  {
    title: "Property Management",
    items: [
      { name: "Vacancy & Occupancy", desc: "Track unit availability & days vacant.", href: "/reports/occupancy", Icon: Users2 },
      { name: "Lease Expiry", desc: "Leases expiring soon.", href: "/reports/lease-expiry", Icon: KeyRound },
      { name: "Tenant Ledger", desc: "All tenant payments & notes.", href: "/reports/tenant-ledger", Icon: Users2 },
      { name: "Unit Financials", desc: "Income vs expense per unit.", href: "/reports/unit-financials", Icon: CircleDollarSign },
      { name: "Maintenance", desc: "Tickets & resolution stats.", href: "/reports/maintenance", Icon: Wrench },
      { name: "Utility Charges", desc: "Water & electricity billing audit.", href: "/reports/utility-charges", Icon: Zap },
      { name: "Owner Summary", desc: "Rent, expenses, and net income per owner.", href: "/reports/owner-summary", Icon: ScrollText },
      { name: "KPI Dashboard", desc: "Occupancy, arrears, and profitability KPIs.", href: "/reports/kpi-dashboard", Icon: LineChart },
      { name: "Month-End Close", desc: "Checklist status across properties.", href: "/reports/month-end", Icon: CalendarClock },
      { name: "Supplier Directory", desc: "Vendors & contact info.", href: "/reports/supplier-directory", Icon: Truck },
    ],
  },
];

const GROUP_DESCRIPTIONS: Record<string, string> = {
  Banking: "Cash movement, reconciliation, and statement imports.",
  Accounting: "Financial statements, ledger, and journals.",
  "Rent Payments": "Rent collection, arrears, and deposit tracking.",
  "Property Management": "Operations, occupancy, maintenance, and utilities.",
};

const FILTERS = ["All", "Banking", "Accounting", "Rent", "Property"];

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/reports/pinned", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.pinned)) {
          setPinned(data.pinned);
        }
      })
      .catch(() => {});
  }, []);

  const filteredGroups = useMemo(() => {
    return REPORT_GROUPS.map((group) => {
      const filterMatch =
        activeFilter === "All" ||
        (activeFilter === "Rent" && group.title === "Rent Payments") ||
        (activeFilter === "Property" && group.title === "Property Management") ||
        group.title === activeFilter;

      if (!filterMatch) return null;

      const items = group.items.filter((item) => {
        if (!normalizedQuery) return true;
        return (
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.desc.toLowerCase().includes(normalizedQuery)
        );
      });

      if (!items.length) return null;
      return { ...group, items };
    }).filter(Boolean) as typeof REPORT_GROUPS;
  }, [activeFilter, normalizedQuery]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">Reports & Analytics</h1>
        <p className="text-sm text-slate-400">Access standard reports or create a custom view.</p>
      </div>

      <div className="space-y-3">
        <div className="flex max-w-lg items-center gap-3 rounded-xl border border-white/10 bg-panel/70 px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search reports..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              type="button"
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeFilter === filter
                  ? "border-white/20 bg-white/10 text-slate-100"
                  : "border-white/10 bg-panel/50 text-slate-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-6">
          {filteredGroups.map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {group.title}
                </p>
                <p className="text-sm text-slate-400">{GROUP_DESCRIPTIONS[group.title]}</p>
              </div>
              <SectionCard className="p-0">
                <div className="divide-y divide-white/10">
                  {group.items.map((item) => (
                    <ReportRow
                      key={item.href}
                      {...item}
                      pinned={pinned.includes(item.href)}
                      onTogglePin={async () => {
                        const next = pinned.includes(item.href)
                          ? pinned.filter((id) => id !== item.href)
                          : [...pinned, item.href];
                        setPinned(next);
                        await fetch("/api/reports/pinned", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pinned: next }),
                        });
                      }}
                    />
                  ))}
                </div>
              </SectionCard>
            </section>
          ))}
          {!filteredGroups.length ? (
            <SectionCard className="p-6 text-sm text-slate-400">
              No reports match your search or filter.
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-4 pt-14">
          <SectionCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
            <div className="mt-3 space-y-2 text-sm">
              <Link href="/reports/custom" className="block text-accent hover:underline">
                Build custom report
              </Link>
              <Link href="/reports/export-centre" className="block text-slate-300 hover:text-slate-100">
                Export centre
              </Link>
            </div>
          </SectionCard>

          <SectionCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pinned Reports</p>
            <div className="mt-3 space-y-2 text-sm">
              {pinned.length === 0 ? (
                <p className="text-slate-500">No pinned reports yet.</p>
              ) : (
                REPORT_GROUPS.flatMap((group) => group.items)
                  .filter((item) => pinned.includes(item.href))
                  .map((item) => (
                    <Link key={item.href} href={item.href} className="block text-slate-200 hover:text-slate-100">
                      {item.name}
                    </Link>
                  ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ReportRow({
  href,
  name,
  desc,
  Icon,
  pinned,
  onTogglePin,
}: ReportTileItem & { pinned?: boolean; onTogglePin?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-slate-300">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-slate-300">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-100">{name}</p>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={onTogglePin}
          className={`rounded-full border p-1 ${
            pinned
              ? "border-accent/40 text-accent"
              : "border-white/10 text-slate-400 hover:text-slate-100"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${pinned ? "fill-current" : ""}`} />
        </button>
        <Link href={href} className="text-accent hover:underline">
          Open
        </Link>
      </div>
    </div>
  );
}
