"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";

type DocPreview = {
  content: string;
  updatedAt: string;
};

export default function AdminDashboardPage() {
  const [sop, setSop] = useState<DocPreview>({ content: "", updatedAt: "" });
  const [rules, setRules] = useState<DocPreview>({ content: "", updatedAt: "" });

  useEffect(() => {
    fetch("/api/admin/sop", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSop(data.doc || { content: "", updatedAt: "" }))
      .catch(() => setSop({ content: "", updatedAt: "" }));

    fetch("/api/admin/house-rules", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setRules(data.doc || { content: "", updatedAt: "" }))
      .catch(() => setRules({ content: "", updatedAt: "" }));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Quick access to SOP and building rules.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-500">Manage team access levels</p>
            </div>
            <Link
              href="/admin/settings"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Open
            </Link>
          </div>
          <p className="mt-3 line-clamp-4 text-sm text-slate-600">Update roles for admin and reception staff.</p>
        </SectionCard>

        <SectionCard className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">SOP</h2>
              <p className="text-xs text-slate-500">System of Operations</p>
            </div>
            <Link
              href="/admin/sop"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Open
            </Link>
          </div>
          <p className="mt-3 line-clamp-4 text-sm text-slate-600">{sop.content || "No SOP content yet."}</p>
          {sop.updatedAt && <p className="mt-2 text-xs text-slate-400">Updated {sop.updatedAt}</p>}
        </SectionCard>

        <SectionCard className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">House Rules</h2>
              <p className="text-xs text-slate-500">Tenant-facing building rules</p>
            </div>
            <Link
              href="/admin/house-rules"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Open
            </Link>
          </div>
          <p className="mt-3 line-clamp-4 text-sm text-slate-600">{rules.content || "No house rules yet."}</p>
          {rules.updatedAt && <p className="mt-2 text-xs text-slate-400">Updated {rules.updatedAt}</p>}
        </SectionCard>
      </div>
    </div>
  );
}
