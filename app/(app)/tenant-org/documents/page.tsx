"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { CommercialDocument } from "@/lib/commercial";

export default function TenantOrgDocumentsPage() {
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);

  useEffect(() => {
    fetch("/api/tenant-org/documents", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(() => setDocuments([]));
  }, []);

  const grouped = useMemo(() => {
    return documents.reduce<Record<string, CommercialDocument[]>>((acc, doc) => {
      acc[doc.type] = acc[doc.type] || [];
      acc[doc.type].push(doc);
      return acc;
    }, {});
  }, [documents]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">Access lease, compliance, and statement documents.</p>
      </header>

      <SectionCard className="p-4">
        {Object.keys(grouped).length ? (
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, docs]) => (
              <div key={type}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{type.replace("_", " ")}</h2>
                <div className="mt-2 space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                        <p className="text-xs text-slate-500">Uploaded {doc.uploadedAt}</p>
                      </div>
                      <a
                        href={doc.url}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No documents yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
