"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { FacilitiesTicket, Invoice, Notice, TenantOrg } from "@/lib/commercial";

type MePayload = {
  org: TenantOrg;
};

export default function TenantOrgDashboardPage() {
  const [org, setOrg] = useState<TenantOrg | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<FacilitiesTicket[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/tenant-org/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean } & MePayload) => {
        if (data?.ok !== false) setOrg(data.org);
      })
      .catch(() => setOrg(null));

    fetch("/api/tenant-org/invoices", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices || []))
      .catch(() => setInvoices([]));

    fetch("/api/tenant-org/facilities", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets || []))
      .catch(() => setTickets([]));

    fetch("/api/tenant-org/notices", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setNotices(data.notices || []))
      .catch(() => setNotices([]));
  }, []);

  const currentBalance = useMemo(
    () => invoices.filter((inv) => inv.status === "open" || inv.status === "overdue").reduce((sum, inv) => sum + inv.amount, 0),
    [invoices],
  );

  const nextDue = useMemo(() => {
    return [...invoices]
      .filter((inv) => inv.status !== "paid")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  }, [invoices]);

  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved").length;
  const latestNotices = notices.slice(0, 3);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome {org?.name || "back"}</h1>
        <p className="text-sm text-slate-500">Overview of your workspace activity.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Current balance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">${currentBalance.toFixed(2)}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Next due</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {nextDue ? `${nextDue.period} · $${nextDue.amount.toFixed(2)}` : "No upcoming invoices"}
          </p>
          {nextDue && <p className="text-xs text-slate-500">Due {nextDue.dueDate}</p>}
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Open tickets</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{openTickets}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Latest notices</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{latestNotices.length}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">Latest notices</h2>
        <div className="mt-3 space-y-3">
          {latestNotices.length ? (
            latestNotices.map((notice) => (
              <div key={notice.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                <p className="text-xs text-slate-500">{notice.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No notices yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
