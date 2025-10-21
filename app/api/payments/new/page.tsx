"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LeaseOpt = { id:number; label:string };

export default function NewPaymentPage() {
  const [leases, setLeases] = useState<LeaseOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // small helper endpoint from leases GET: build a label for the dropdown
    fetch("/api/leases").then(r=>r.json()).then((ls:any[]) => {
      setLeases(ls.map(l => ({ id:l.id, label: `${l.tenant} – ${l.property}` })));
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        lease_id: Number(fd.get("lease_id")),
        paid_on: fd.get("paid_on"),
        amount: Number(fd.get("amount")),
        method: fd.get("method"),
      })
    });
    setLoading(false);
    if (res.ok) router.push("/dashboard"); else alert("Failed to record payment");
  }

  return (
    <main className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Record Payment</h1>
      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-4 space-y-3">
        <select name="lease_id" required className="w-full border rounded p-2">
          <option value="">Select lease</option>
          {leases.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <input name="paid_on" type="date" required className="w-full border rounded p-2" />
        <input name="amount" type="number" step="0.01" placeholder="Amount" required className="w-full border rounded p-2"/>
        <input name="method" placeholder="Method (bank, cash…)" className="w-full border rounded p-2"/>
        <button disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </main>
  );
}
