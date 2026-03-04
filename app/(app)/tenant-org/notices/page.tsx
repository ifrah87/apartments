"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import type { Notice } from "@/lib/commercial";

export default function TenantOrgNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/tenant-org/notices", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setNotices(data.notices || []))
      .catch(() => setNotices([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Notices</h1>
        <p className="text-sm text-slate-500">Building announcements and updates.</p>
      </header>

      <SectionCard className="p-4">
        <div className="space-y-3">
          {notices.length ? (
            notices.map((notice) => (
              <div key={notice.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{notice.title}</h2>
                  <span className="text-xs text-slate-400">{notice.createdAt}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{notice.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No notices published yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
