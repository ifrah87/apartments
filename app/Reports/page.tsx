import Link from "next/link";
import {
  CircleDollarSign,
  CalendarClock,
  ScrollText,
  KeyRound,
  Users2,
  Wrench,
  Truck,
  LineChart,
  ChevronRight,
  Wallet,
  Zap,
  Scale,
  BookOpen,
  Calculator,
  NotebookPen,
  ListOrdered,
} from "lucide-react";

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
      { name: "Manual Payments", desc: "Record off-bank tenant receipts.", href: "/reports/manual-payments", Icon: CircleDollarSign },
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

export const runtime = "nodejs";

export default async function ReportsPage() {
  return (
    <div className="space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Jump straight into any report or build your own view.</p>
        </div>
        <Link
          href="/reports/custom"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
        >
          Build custom report
        </Link>
      </header>

      <div className="space-y-6">
        {REPORT_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <ReportTile key={item.href} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ReportTile({ href, name, desc, Icon }: ReportTileItem) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-200">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-900">{name}</span>
        <span className="block text-sm text-slate-500">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
    </Link>
  );
}
