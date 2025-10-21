"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

/**
 * Single-page Properties with tabs: Overview | Units | Tenants
 * - One building only (Taleex Apartments)
 * - Search (unit / floor / tenant) persists across tabs
 * - CSV upload merges tenants by unit
 */

const PROPERTY = {
  id: "taleex-apartments",
  name: "Taleex Apartments",
  address: "Taleex District",
};

type Row = {
  unit: string;
  floor: number;
  type: string;
  beds: number;
  rent: number;
  status: string; // "Occupied" | "Vacant"
  tenant_name?: string;
  lease_start?: string;
  lease_end?: string;
};

export default function PropertiesPage() {
  const [tab, setTab] = useState<"overview" | "units" | "tenants">("overview");
  const [units, setUnits] = useState<Row[]>([]);
  const [tenantsByUnit, setTenantsByUnit] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [floor, setFloor] = useState("ALL");

  /** Load units from /api/units (CSV-backed). If empty or error → fallback generator. */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/units?ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`/api/units returned ${res.status}`);
        const text = await res.text();

        let rows: any;
        try {
          rows = JSON.parse(text); // JSON already
        } catch {
          rows = Papa.parse(text, { header: true }).data; // CSV string
        }

        const norm = normalizeRows(rows);
        setUnits(norm.length ? norm : buildUnitsFor11Floors()); // fallback if []
      } catch {
        setUnits(buildUnitsFor11Floors());
      }
    })();
  }, []);

  /** Restore tenants.csv map if previously uploaded */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tenants_csv_map");
      if (raw) setTenantsByUnit(JSON.parse(raw));
    } catch {}
  }, []);

  /** Merge tenant CSV data onto units */
  const merged: Row[] = useMemo(() => {
    return (units || []).map((u) => {
      const t = tenantsByUnit[u.unit] || {};
      const statusValue = (t.status || u.status || "").toString().trim() || "Vacant";
      return {
        ...u,
        status: statusValue,
        tenant_name: t.tenant_name || t.tenant || u.tenant_name || "",
        lease_start: t.lease_start || u.lease_start || "",
        lease_end: t.lease_end || u.lease_end || "",
      };
    });
  }, [units, tenantsByUnit]);

  const occupied = merged.filter((r) => r.status.toLowerCase() === "occupied");
  const vacant = merged.filter((r) => r.status.toLowerCase() !== "occupied");
  const occRate = merged.length ? Math.round((occupied.length / merged.length) * 100) : 0;
  const expectedRent = occupied.reduce((a, r) => a + (Number(r.rent) || 0), 0);

  /** Filters + search */
  const filtered = merged.filter((u) => {
    const okStatus = status === "ALL" || u.status === status;
    const okFloor = floor === "ALL" || String(u.floor) === String(floor);
    const q = search.trim().toLowerCase();
    const okSearch =
      !q ||
      u.unit.toLowerCase().includes(q) ||
      String(u.floor) === q ||
      (u.tenant_name || "").toLowerCase().includes(q);
    return okStatus && okFloor && okSearch;
  });

  const filteredTenants = filtered.filter((r) => r.status.toLowerCase() === "occupied");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-semibold">Properties</h1>
          <p className="text-slate-500 text-sm">
            {PROPERTY.name} — {PROPERTY.address}
          </p>
        </div>

        {/* Tabs + Search + Upload */}
        <div className="mb-4 flex items-center gap-6 border-b border-slate-200 text-sm">
          <button
            className={`pb-3 ${tab === "overview" ? "border-b-2 border-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            className={`pb-3 ${tab === "units" ? "border-b-2 border-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            onClick={() => setTab("units")}
          >
            Units
          </button>
          <button
            className={`pb-3 ${tab === "tenants" ? "border-b-2 border-slate-900" : "text-slate-500 hover:text-slate-900"}`}
            onClick={() => setTab("tenants")}
          >
            Tenants
          </button>

          <div className="ml-auto flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit / floor / tenant"
              className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
            <TenantCsvUploader onParsed={(m) => setTenantsByUnit(m)} />
          </div>
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Units" value={merged.length} />
            <StatCard
              label="Occupied"
              value={`${occupied.length} (${occRate}%)`}
              pillClass="bg-green-50 text-green-700 border-green-200"
            />
            <StatCard
              label="Vacant"
              value={vacant.length}
              pillClass="bg-amber-50 text-amber-700 border-amber-200"
            />
            <StatCard label="Expected Rent" value={`$${expectedRent.toLocaleString()}`} span={3} />
          </div>
        )}

        {/* UNITS */}
        {tab === "units" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Status</label>
                <Select value={status} onChange={setStatus} options={["ALL", "Occupied", "Vacant"]} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Floor</label>
                <Select value={floor} onChange={setFloor} options={["ALL", ...Array.from({ length: 11 }, (_, i) => String(i + 1))]} />
              </div>
            </div>

            <UnitsTable rows={filtered} />
          </section>
        )}

        {/* TENANTS */}
        {tab === "tenants" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Unit</Th>
                  <Th>Tenant</Th>
                  <Th>Floor</Th>
                  <Th>Type</Th>
                  <Th>Lease</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((r) => (
                  <tr key={`t-${r.unit}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <Td className="font-medium text-slate-900">{r.unit}</Td>
                    <Td>{r.tenant_name || "—"}</Td>
                    <Td>{r.floor}</Td>
                    <Td>{r.type}</Td>
                    <Td>{r.lease_start && r.lease_end ? `${r.lease_start} → ${r.lease_end}` : "—"}</Td>
                    <Td>
                      <Badge variant="green">Occupied</Badge>
                    </Td>
                  </tr>
                ))}
                {filteredTenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No tenants to display
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------- Reusable table bits ---------------- */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-slate-700 ${className}`}>{children}</td>;
}

/* ---------------- Components ---------------- */

function UnitsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="text-slate-600">
            <Th>Unit</Th>
            <Th>Type</Th>
            <Th>Beds</Th>
            <Th>Floor</Th>
            <Th>Rent</Th>
            <Th>Status</Th>
            <Th>Tenant</Th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.unit} className="border-t border-slate-100 hover:bg-slate-50/60">
              <Td className="font-medium text-slate-900">{r.unit}</Td>
              <Td>{r.type}</Td>
              <Td>{r.beds}</Td>
              <Td>
                <span className={`inline-flex items-center rounded-xl px-2 py-1 text-xs border ${floorBadge(r.floor)}`}>
                  Floor {r.floor}
                </span>
              </Td>
              <Td>{r.rent ? `$${Number(r.rent).toLocaleString()}` : "—"}</Td>
              <Td>
                <Badge variant={r.status.toLowerCase() === "occupied" ? "green" : "amber"}>{r.status}</Badge>
              </Td>
              <Td>{r.tenant_name || "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  pillClass = "",
  span = 1,
}: {
  label: string;
  value: React.ReactNode;
  pillClass?: string;
  span?: number;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${span === 3 ? "md:col-span-3" : ""}`}>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {pillClass && <div className={`mt-2 inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${pillClass}`}>{label}</div>}
    </div>
  );
}

function Badge({
  children,
  variant = "slate",
}: {
  children: React.ReactNode;
  variant?: "green" | "amber" | "slate";
}) {
  const theme =
    variant === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : variant === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${theme}`}>{children}</span>;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function floorBadge(floor: number) {
  if (floor <= 3) return "bg-slate-50 text-slate-700 border-slate-200";
  if (floor <= 7) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

/* ---------------- Helpers ---------------- */

/** Accepts array OR object (e.g., {0:{...},1:{...}}) and normalizes safely. */
function normalizeRows(input: any): Row[] {
  const arr = Array.isArray(input)
    ? input
    : input && typeof input === "object"
    ? Object.values(input as any)
    : [];

  return (arr as any[])
    .filter(Boolean)
    .map((r: any) => ({
      unit: String(r.unit ?? r.Unit ?? r.UNIT ?? "").trim(),
      floor: Number((r.floor ?? r.Floor ?? r.FLOOR ?? "").toString().trim() || 0),
      type: String(r.type ?? r.Type ?? r.TYPE ?? "").trim(),
      beds: Number((r.beds ?? r.Beds ?? r.BEDS ?? "").toString().trim() || 0),
      rent: Number((r.rent ?? r.Rent ?? r.RENT ?? "").toString().trim() || 0),
      status: String(r.status ?? r.Status ?? r.STATUS ?? "Vacant").trim(),
      tenant_name: (r.tenant_name ?? r.tenant ?? r.Tenant ?? "").toString().trim(),
      lease_start: (r.lease_start ?? r.LeaseStart ?? r.LEASE_START ?? "").toString().trim(),
      lease_end: (r.lease_end ?? r.LeaseEnd ?? r.LEASE_END ?? "").toString().trim(),
    }))
    .filter((row) => row.unit);
}

/** Fallback generator (uniform per-floor mix: 1 Studio, 2×3-bed, 3×4-bed) */
function buildUnitsFor11Floors(): Row[] {
  const rows: Row[] = [];
  for (let floor = 1; floor <= 11; floor++) {
    const mix = ["Studio", "3 Bed", "3 Bed", "4 Bed", "4 Bed", "4 Bed"];
    mix.forEach((type, idx) => {
      const unit = floor * 100 + (idx + 1);
      rows.push({
        unit: String(unit),
        floor,
        type,
        beds: type === "Studio" ? 0 : type === "3 Bed" ? 3 : 4,
        rent: 0,
        status: "Vacant",
      });
    });
  }
  return rows;
}

/** CSV Uploader for tenants */
function TenantCsvUploader({ onParsed }: { onParsed: (m: Record<string, any>) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() || "";
      const parsed = Papa.parse(text, { header: true });
      const rows = (parsed.data as any[]).filter(Boolean);
      const map: Record<string, any> = {};
      for (const r of rows) {
        const unit = String((r.unit ?? r.Unit ?? "").toString().trim());
        if (!unit) continue;
        map[unit] = {
          tenant_name: r.tenant_name || r.tenant || "",
          email: r.email || "",
          phone: r.phone || "",
          status: r.status || "",
          lease_start: r.lease_start || "",
          lease_end: r.lease_end || "",
        };
      }
      try {
        localStorage.setItem("tenants_csv_map", JSON.stringify(map));
      } catch {}
      onParsed(map);
    };
    reader.readAsText(file);
  }
  return (
    <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 cursor-pointer">
      <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
      Upload tenants.csv
    </label>
  );
}
