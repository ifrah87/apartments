"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { Invoice } from "@/lib/commercial";

export default function TenantOrgInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetch("/api/tenant-org/invoices", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices || []))
      .catch(() => setInvoices([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices & statements</h1>
        <p className="text-sm text-slate-500">Download invoices and track payment status.</p>
      </header>

      <SectionCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Issue date</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">{invoice.issueDate}</td>
                <td className="px-4 py-3 text-slate-600">{invoice.period}</td>
                <td className="px-4 py-3 text-slate-600">{invoice.type.replace("_", " ")}</td>
                <td className="px-4 py-3 text-slate-900">${invoice.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-600">{invoice.status}</td>
                <td className="px-4 py-3 text-right">
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">PDF pending</span>
                  )}
                </td>
              </tr>
            ))}
            {!invoices.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard className="p-4">
        <h2 className="text-lg font-semibold text-slate-900">Payment instructions</h2>
        <div className="mt-2 text-sm text-slate-600">
          <p>Bank: Orfane Commercial Bank</p>
          <p>Account: 092381992</p>
          <p>Sort code: 11-22-33</p>
          <p>Reference format: ORG-{invoices[0]?.tenantOrgId?.slice(0, 6) || "XXXXXX"}</p>
        </div>
      </SectionCard>
    </div>
  );
}
