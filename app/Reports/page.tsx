"use client"

import {
    Building2,
    FileText,
    Wallet,
    CalendarClock,
    ScrollText,
    ChevronRight,
    CircleDollarSign,
    KeyRound, 
    Users2, 
    Wrench, 
    Truck, 
    LineChart,
} from "lucide-react";
import Link from "next/link";


/*---------------------------------------------------Report types-------------------------------------------------------------------*/

type Report = { name: string; desc: string; href: string; Icon: React.ElementType };
const GROUPS : { title: string; items: Report [] } [] = [
    {
        title: "Accounting",
        items: [
            { name: "Income Expense Statement", desc: "Complete breakdown of income & expenses.", href: "/reports/income-expense", Icon: FileText },
            { name: "Property Income & Expense Summary", desc: "Groups multi-units by category.", href: "/reports/property-summary", Icon: Building2 },
            { name: "P&L Summary", desc: "One-line summary per property.", href: "/reports/pl-summary", Icon: LineChart },
            { name: "Account Transactions", desc: "Details incl. running balance per property.", href: "/reports/account-transactions", Icon: Wallet },
            { name: "Accounts Payable Summary", desc: "summary of payables.", href: "/reports/accounts-payable-summary", Icon: Wallet },
            { name: " Accounts Receivable Summary", desc: "summary of receivables.", href: "/reports/accounts-recievable summary", Icon: Wallet },
        ],
    },  
{
        title: "Rent Payments",
        items: [
            { name: "Rent Ledger", desc: "Payments due vs received.", href: "/reports/rent-ledger", Icon: CircleDollarSign },
            { name: "Overdue Rent Payments", desc: "Overdue & late fees.", href: "/reports/overdue-rent", Icon: CalendarClock },
            { name: "Rent Roll", desc: "Expected rent on a date.", href: "/reports/rent-roll", Icon: ScrollText },
            { name: "Rent Changes", desc: "Past & scheduled rent changes.", href: "/reports/rent-changes", Icon: ScrollText },
        ],
    },
{
        title: "Expenses",
        items: [
            { name: "Upcoming Expenses", desc: "Unpaid expenses in period.", href: "/reports/upcoming-expenses", Icon: KeyRound },
            { name: "Supplier Expenses", desc: "By supplier & category.", href: "/reports/supplier-expenses", Icon: Truck },
        ],
    },
{
        title: "Property Management",
        items: [
            { name: "Reminders", desc: "Summary of reminders.", href: "/reports/reminders", Icon: CalendarClock },
            { name: "Tenant Ledger", desc: "Tenant payments vs logs.", href: "/reports/tenant-ledger", Icon: Users2 },
            { name: "Lease Expiry", desc: "Leases expiring in window.", href: "/reports/lease-expiry", Icon: KeyRound },
            { name: "Maintenance", desc: "Maintenance summary.", href: "/reports/maintenance", Icon: Wrench },
            { name: "Supplier Directory", desc: "Suppliers & contacts.", href: "/reports/supplier-directory", Icon: Truck },
        ], 
    },
];
    
/*-------------------------------------------------------- ui bits---------------------------------------*/

function Tile({ href, name, desc, Icon }: Report) {
  return (
    <Link
      href={href}
      className="
        group flex items-center gap-4 rounded-xl border border-slate-200
        px-4 py-3 transition hover:bg-slate-50 hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500
      "
    >
      {/* icon bubble */}
      <span
        className="
          grid h-10 w-10 place-items-center rounded-full
          bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100
        "
      >
        <Icon className="h-5 w-5" />
      </span>

      {/* text */}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-800">
          {name}
        </span>
        <span className="block text-sm text-slate-500 truncate">
          {desc}
        </span>
      </span>

      {/* chevron */}
      <ChevronRight
        className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/* ----------------------------------------------------------page-------------------------------------------------------------------*/

export default function ReportsPage (){
    return (
    <div className="p-6 space-y-10">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-4">
          <h2 className="text-lg font-bold text-slate-700">{g.title}</h2>

          {/* 2-column layout (1 on mobile) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {g.items.map((r) => (
              <Tile key={r.name} {...r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
    
