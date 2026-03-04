"use client";

import { useEffect, useMemo, useState } from "react";
import ChecklistItem from "@/components/ui/ChecklistItem";
import ProgressBar from "@/components/ui/ProgressBar";
import type { DocumentRecord, Lease, OnboardingCheckpoints, Tenant } from "@/lib/onboarding";

type TenantResponse = {
  tenant: Tenant;
  lease?: Lease;
  checkpoints?: OnboardingCheckpoints;
  documents?: DocumentRecord[];
};

export default function TenantWelcomePage() {
  const [data, setData] = useState<TenantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const refresh = () => {
    setLoading(true);
    fetch("/api/tenant/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.ok) {
          throw new Error(payload?.error || "Unauthorized.");
        }
        setData(payload);
        setContactForm({
          phone: payload.tenant?.phone || "",
          emergencyContactName: payload.tenant?.emergencyContactName || "",
          emergencyContactPhone: payload.tenant?.emergencyContactPhone || "",
        });
      })
      .catch((err) => setMessage(err?.message || "Unable to load tenant."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const checkpoints = data?.checkpoints;
  const completedCount = useMemo(() => {
    if (!checkpoints) return 0;
    return [
      checkpoints.leaseAcknowledged,
      checkpoints.contactConfirmed,
      checkpoints.moveInConditionConfirmed,
      checkpoints.tenantFirstLogin,
    ].filter(Boolean).length;
  }, [checkpoints]);
  const progress = Math.round((completedCount / 4) * 100);

  const leaseDoc = data?.documents?.find((doc) => doc.type === "lease");

  const updateCheckpoints = async (payload: Record<string, unknown>) => {
    setMessage(null);
    const res = await fetch("/api/tenant/checkpoints", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await res.json();
    if (!res.ok || !response?.ok) {
      setMessage(response?.error || "Update failed.");
      return;
    }
    refresh();
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading your welcome checklist...</p>;
  }

  if (!data?.tenant || !checkpoints) {
    return <p className="text-sm text-rose-600">{message || "Unable to load tenant."}</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {data.tenant.fullName}</h1>
        <p className="text-sm text-slate-500">Complete these steps to finish your move-in setup.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Completion</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      </div>

      {message && <p className="text-sm text-rose-600">{message}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1) Review documents</h2>
        <ChecklistItem
          title="Lease acknowledgement"
          description={leaseDoc ? "Read and acknowledge your lease." : "Lease document will appear here."}
          status={checkpoints.leaseAcknowledged ? "done" : "pending"}
          action={
            leaseDoc && !checkpoints.leaseAcknowledged ? (
              <div className="flex items-center gap-2">
                <a
                  href={leaseDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                >
                  View lease
                </a>
                <button
                  type="button"
                  onClick={() => updateCheckpoints({ leaseAcknowledged: true })}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  I acknowledge
                </button>
              </div>
            ) : undefined
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2) Payments</h2>
        <ChecklistItem
          title="Deposit"
          description={`Expected: ${data.checkpoints?.depositExpected ?? 0} · Status: ${
            checkpoints.depositReceived ? "Received" : "Pending"
          }`}
          status={checkpoints.depositReceived ? "done" : "pending"}
        />
        <ChecklistItem
          title="First rent"
          description={`Expected: ${data.checkpoints?.firstRentExpected ?? 0} · Status: ${
            checkpoints.firstRentReceived ? "Received" : "Pending"
          }`}
          status={checkpoints.firstRentReceived ? "done" : "pending"}
        />
        {!checkpoints.depositReceived || !checkpoints.firstRentReceived ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            Payment instructions: please transfer funds to the management account shared in your lease packet.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3) Confirm contact details</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Phone"
              value={contactForm.phone}
              onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Emergency contact name"
              value={contactForm.emergencyContactName}
              onChange={(e) => setContactForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Emergency contact phone"
              value={contactForm.emergencyContactPhone}
              onChange={(e) => setContactForm((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              updateCheckpoints({
                contactConfirmed: true,
                phone: contactForm.phone,
                emergencyContactName: contactForm.emergencyContactName,
                emergencyContactPhone: contactForm.emergencyContactPhone,
              })
            }
            className="mt-3 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
          >
            {checkpoints.contactConfirmed ? "Update" : "Confirm details"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4) Move-in condition</h2>
        <ChecklistItem
          title="Move-in condition confirmed"
          description="I confirm the unit condition or reported issues within 72 hours."
          status={checkpoints.moveInConditionConfirmed ? "done" : "pending"}
          action={
            !checkpoints.moveInConditionConfirmed ? (
              <button
                type="button"
                onClick={() => updateCheckpoints({ moveInConditionConfirmed: true })}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                Confirm condition
              </button>
            ) : undefined
          }
        />
      </section>

      {checkpoints.leaseAcknowledged && checkpoints.contactConfirmed && checkpoints.depositReceived &&
      checkpoints.firstRentReceived ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <p>You are ready to move in. Your management team will activate your portal soon.</p>
          <a href="/tenant/dashboard" className="mt-2 inline-flex text-xs font-semibold text-emerald-700 underline">
            Go to dashboard
          </a>
        </div>
      ) : null}
    </div>
  );
}
