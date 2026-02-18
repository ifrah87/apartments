"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEFAULT_LEASES, type LeaseAgreement } from "@/lib/leases";
import { DEFAULT_LEASE_TEMPLATE } from "@/lib/settings/defaults";
import type { LeaseTemplateSettings } from "@/lib/settings/types";
import { FileDown, ArrowLeft } from "lucide-react";

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("en-GB");

function formatCurrency(value: number) {
  return formatter.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "Open Ended";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function buildCsv(lease: LeaseAgreement) {
  const lines = [
    ["Property", lease.property || ""],
    ["Unit", lease.unit],
    ["Tenant", lease.tenantName],
    ["Tenant Phone", lease.tenantPhone || ""],
    ["Status", lease.status],
    ["Billing Cycle", lease.cycle],
    ["Start Date", lease.startDate],
    ["End Date", lease.endDate || ""],
    ["Rent", lease.rent.toFixed(2)],
    ["Deposit", lease.deposit.toFixed(2)],
  ];
  return lines.map((row) => row.map((value) => `"${String(value).replace(/\"/g, '""')}"`).join(",")).join("\n");
}

function downloadCsv(lease: LeaseAgreement) {
  const csv = buildCsv(lease);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lease-statement-${lease.unit}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=1280,height=720");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function LeaseStatementDetailPage() {
  const params = useParams();
  const leaseId = params?.leaseId as string;
  const [lease, setLease] = useState<LeaseAgreement | null>(null);
  const [template, setTemplate] = useState<LeaseTemplateSettings>(DEFAULT_LEASE_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  useEffect(() => {
    if (!leaseId) return;
    setLoading(true);
    fetch("/api/lease-agreements", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = (payload?.ok ? payload.data : payload) as LeaseAgreement[];
        const all = Array.isArray(data) && data.length ? data : DEFAULT_LEASES;
        setLease(all.find((item) => item.id === leaseId) || null);
      })
      .catch(() => {
        const fallback = DEFAULT_LEASES.find((item) => item.id === leaseId) || null;
        setLease(fallback);
      })
      .finally(() => setLoading(false));
  }, [leaseId]);

  useEffect(() => {
    fetch("/api/settings/lease-template", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        const data = (payload?.ok ? payload.data : payload) as LeaseTemplateSettings;
        if (data) setTemplate(data);
      })
      .catch(() => {})
      .finally(() => setTemplateLoaded(true));
  }, []);

  const renderedHtml = useMemo(() => {
    if (!lease) return "";
    const replacements: Record<string, string> = {
      property: lease.property || "",
      tenantName: lease.tenantName || "",
      tenantPhone: lease.tenantPhone || "",
      unit: lease.unit,
      status: lease.status,
      rent: formatCurrency(lease.rent),
      deposit: formatCurrency(lease.deposit),
      cycle: lease.cycle,
      startDate: formatDate(lease.startDate),
      endDate: lease.endDate ? formatDate(lease.endDate) : "Open Ended",
      leaseDuration: lease.leaseDuration || "Manual Date / Open",
      today: formatDate(new Date().toISOString()),
    };
    let html = template.htmlTemplate || "";
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, value);
    });
    return html;
  }, [lease, template]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading lease statement...</p>;
  }

  if (!lease) {
    return (
      <SectionCard className="p-6 text-sm text-slate-400">
        Lease not found. <Link href="/reports/lease-statements" className="text-accent underline">Back to report</Link>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease Statement"
        subtitle={`${lease.property || "Property"} · Unit ${lease.unit} · ${lease.tenantName}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (template.mode === "html") {
                  openPrintWindow(renderedHtml);
                } else if (template.mode === "pdf" && template.pdfDataUrl) {
                  window.open(template.pdfDataUrl, "_blank");
                } else if (template.mode === "url" && template.externalUrl) {
                  window.open(template.externalUrl, "_blank");
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button
              onClick={() => downloadCsv(lease)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_10px_20px_rgba(56,189,248,0.25)] hover:bg-accent-strong"
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </button>
            <Link
              href="/reports/lease-statements"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        }
      />

      {!templateLoaded ? (
        <SectionCard className="p-6 text-sm text-slate-400">Loading template...</SectionCard>
      ) : template.mode === "html" ? (
        <SectionCard className="overflow-hidden p-0">
          <iframe title="Lease Statement" srcDoc={renderedHtml} className="h-[70vh] w-full bg-white" />
        </SectionCard>
      ) : template.mode === "pdf" ? (
        <SectionCard className="overflow-hidden p-0">
          {template.pdfDataUrl ? (
            <iframe title="Lease PDF" src={template.pdfDataUrl} className="h-[70vh] w-full bg-white" />
          ) : (
            <div className="p-6 text-sm text-slate-400">Upload a PDF template in Settings → Lease Template.</div>
          )}
        </SectionCard>
      ) : (
        <SectionCard className="p-6 text-sm text-slate-400">
          {template.externalUrl ? (
            <a href={template.externalUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              Open lease template
            </a>
          ) : (
            "Provide an external URL in Settings → Lease Template."
          )}
        </SectionCard>
      )}
    </div>
  );
}
