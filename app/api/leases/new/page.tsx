"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Opt = { id:number; name?:string; full_name?:string };

export default function NewLeasePage() {
  const [tenants, setTenants] = useState<Opt[]>([]);
  const [properties, setProperties] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/tenants").then(r=>r.json()),
      fetch("/api/properties").then(r=>r.json())
    ]).then(([t,p]) => { setTenants(t); setProperties(p); });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const res = await fetch("/api/leases", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        tenant_id: Number(fd.get("tenant_id")),
        property_id: Number(fd.get("property_id")),
        rent_amount: Number(fd.get("rent_amount")),
        rent_day: Number(fd.get("rent_day")),
        start_date: fd.get("start_date"),
      })
    });
    setLoading(false);
    if (res.ok) router.push("/properties"); else alert("Failed to create lease");
  }

  return (
    <main className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Create Lease</h1>
      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-4 space-y-3">
        <select name="tenant_id" required className="w-full border rounded p-2">
          <option value="">Select tenant</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <select name="property_id" required className="w-full border rounded p-2">
          <option value="">Select property</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input name="rent_amount" type="number" step="0.01" placeholder="Rent amount" required className="w-full border rounded p-2"/>
        <input name="rent_day" type="number" min={1} max={28} placeholder="Rent day (1–28)" required className="w-full border rounded p-2"/>
        <input name="start_date" type="date" required className="w-full border rounded p-2"/>
        <button disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </main>
  );
}
