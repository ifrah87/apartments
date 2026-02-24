"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SectionCard from "@/components/ui/SectionCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getCurrentPropertyId, setCurrentPropertyId } from "@/lib/currentProperty";

type PropertyRecord = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  country?: string | null;
  status?: "active" | "archived";
  created_at?: string | null;
};

type PropertyForm = {
  name: string;
  code: string;
  city: string;
  country: string;
};

const EMPTY_FORM: PropertyForm = {
  name: "",
  code: "",
  city: "",
  country: "",
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties?includeArchived=1", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      const data = (payload?.ok ? payload.data : payload) as PropertyRecord[];
      setProperties(Array.isArray(data) ? data : []);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeProperties = useMemo(
    () => properties.filter((property) => (property.status || "active") === "active"),
    [properties],
  );

  const handleSelect = (propertyId: string) => {
    setCurrentPropertyId(propertyId);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("propertyId", propertyId);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next);
    router.refresh();
    setNotice("Current property updated.");
  };

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      setError(payload?.error || "Failed to create property.");
      return;
    }
    setForm(EMPTY_FORM);
    setShowModal(false);
    await load();
  };

  const handleArchive = async (property: PropertyRecord, status: "active" | "archived") => {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      setError(payload?.error || "Failed to update property.");
      return;
    }
    await load();
  };

  const handleDelete = async (property: PropertyRecord) => {
    if (!confirm(`Delete ${property.name}? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/properties/${property.id}`, { method: "DELETE" });
    const payload = await res.json().catch(() => null);
    if (res.status === 409) {
      setNotice("Cannot delete. Property has units. Archive instead.");
      return;
    }
    if (!res.ok || payload?.ok === false) {
      setError(payload?.error || "Failed to delete property.");
      return;
    }
    await load();
  };

  const currentPropertyId = getCurrentPropertyId();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Create, archive, and manage properties."
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
          >
            Add Property
          </button>
        }
      />

      {error ? (
        <SectionCard className="border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </SectionCard>
      ) : null}

      {notice ? (
        <SectionCard className="border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                    Loading properties...
                  </td>
                </tr>
              ) : properties.length ? (
                properties.map((property) => {
                  const isActive = (property.status || "active") === "active";
                  const isSelected = currentPropertyId === property.id;
                  return (
                    <tr key={property.id} className="border-t border-white/10">
                      <td className="px-3 py-3 text-slate-100">{property.name}</td>
                      <td className="px-3 py-3 text-slate-300">{property.code || "—"}</td>
                      <td className="px-3 py-3">
                        <Badge variant={isActive ? "success" : "warning"}>
                          {isActive ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelect(property.id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isSelected
                                ? "bg-accent text-slate-900"
                                : "border border-white/10 text-slate-200 hover:border-white/20"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(property, isActive ? "archived" : "active")}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-white/20"
                          >
                            {isActive ? "Archive" : "Unarchive"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(property)}
                            className="rounded-full border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400/70"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                    No properties yet. Add your first property.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activeProperties.length ? (
          <p className="mt-4 text-xs text-slate-400">
            Active properties: {activeProperties.length}
          </p>
        ) : null}
      </SectionCard>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Add Property</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:border-white/20"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Name (required)"
                className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
              />
              <input
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="Code (optional)"
                className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                />
                <input
                  value={form.country}
                  onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                  placeholder="Country"
                  className="w-full rounded-xl border border-white/10 bg-panel/80 px-4 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-slate-900"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
