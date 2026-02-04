"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/ui/SectionCard";

type HouseRulesDoc = {
  content: string;
  updatedAt: string;
};

export default function AdminHouseRulesPage() {
  const [doc, setDoc] = useState<HouseRulesDoc>({ content: "", updatedAt: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/house-rules", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setDoc(data.doc || { content: "", updatedAt: "" }))
      .catch(() => setDoc({ content: "", updatedAt: "" }));
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/house-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: doc.content }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save house rules.");
      }
      setDoc(data.doc);
      setMessage("House rules updated.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save house rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">House Rules</h1>
        <p className="text-sm text-slate-500">Maintain the official building rules shared with tenants.</p>
      </header>

      <SectionCard className="p-4">
        <form onSubmit={handleSave} className="space-y-3">
          <textarea
            className="min-h-[320px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            placeholder="Write the house rules here..."
            value={doc.content}
            onChange={(event) => setDoc((prev) => ({ ...prev, content: event.target.value }))}
          />
          {doc.updatedAt && <p className="text-xs text-slate-400">Last updated {doc.updatedAt}</p>}
          {message && <p className="text-sm text-slate-600">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save house rules"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
