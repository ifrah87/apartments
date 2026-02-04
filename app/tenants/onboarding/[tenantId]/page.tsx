"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ChecklistItem from "@/components/ui/ChecklistItem";
import ProgressBar from "@/components/ui/ProgressBar";
import StatusChip from "@/components/ui/StatusChip";
import {
  COMMERCIAL_REQUIRED_FOR_ACTIVE,
  type CommercialDocument,
  type LeaseCommercial,
  type OnboardingCheckpointsCommercial,
  type TenantOrg,
} from "@/lib/commercial";

type OnboardingResponse = {
  org: TenantOrg;
  lease?: LeaseCommercial;
  checkpoints?: OnboardingCheckpointsCommercial;
  documents: CommercialDocument[];
};

export default function OnboardingWizardPage() {
  const params = useParams();
  const orgId = params?.tenantId as string;
  const [data, setData] = useState<OnboardingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [leaseDoc, setLeaseDoc] = useState({ name: "Lease", url: "" });

  const refresh = () => {
    setLoading(true);
    fetch(`/api/admin/tenant-orgs/${orgId}/onboarding`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    refresh();
  }, [orgId]);

  const checkpoints = data?.checkpoints;
  const completedCount = useMemo(() => {
    if (!checkpoints) return 0;
    return Object.entries(checkpoints).filter(([key, value]) => {
      if (
        [
          "tenantOrgId",
          "activationToken",
          "tokenExpiresAt",
          "updatedAt",
          "portalInviteSent",
          "firstLogin",
          "contactsConfirmed",
        ].includes(key)
      ) {
        return false;
      }
      return value === true;
    }).length;
  }, [checkpoints]);
  const totalCheckpoints = 5;
  const progress = totalCheckpoints ? Math.round((completedCount / totalCheckpoints) * 100) : 0;

  const leaseDocExists = data?.documents?.some((doc) => doc.type === "lease");

  const updateCheckpoint = async (payload: Partial<OnboardingCheckpointsCommercial>) => {
    setMessage(null);
    const res = await fetch(`/api/admin/tenant-orgs/${orgId}/onboarding`, {
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

  const uploadDocument = async (
    doc: { name: string; url: string },
    type: CommercialDocument["type"],
    markLeaseUploaded?: boolean,
  ) => {
    setMessage(null);
    const res = await fetch(`/api/admin/tenant-orgs/${orgId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...doc, type, markLeaseUploaded }),
    });
    const response = await res.json();
    if (!res.ok || !response?.ok) {
      setMessage(response?.error || "Upload failed.");
      return;
    }
    refresh();
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading onboarding...</p>;
  }

  if (!data?.org || !checkpoints) {
    return <p className="text-sm text-rose-500">Unable to load onboarding.</p>;
  }

  const canApprove = COMMERCIAL_REQUIRED_FOR_ACTIVE.every((key) => Boolean(checkpoints[key]));

  const approveTenant = async () => {
    setMessage(null);
    const res = await fetch(`/api/admin/tenant-orgs/${orgId}/activate`, { method: "PATCH" });
    const response = await res.json();
    if (!res.ok || !response?.ok) {
      setMessage(response?.error || "Approval failed.");
      return;
    }
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {data.org.propertyId} · {data.org.unitIds.join(", ")}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{data.org.name}</h1>
        </div>
        <StatusChip status={data.org.status} />
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Checklist progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      </div>

      {message && <p className="text-sm text-rose-600">{message}</p>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">1) Lease & Documents</h2>
        <ChecklistItem
          title="Lease uploaded"
          description={leaseDocExists ? "Lease document attached." : "Upload the signed lease document."}
          status={checkpoints.leaseUploaded ? "done" : "pending"}
          onToggle={() => updateCheckpoint({ leaseUploaded: !checkpoints.leaseUploaded })}
          action={
            <div className="flex flex-col gap-2">
              <input
                className="rounded-xl border border-slate-200 px-3 py-1 text-xs"
                placeholder="Lease URL"
                value={leaseDoc.url}
                onChange={(e) => setLeaseDoc((prev) => ({ ...prev, url: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => uploadDocument(leaseDoc, "lease", true)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
              >
                Upload lease
              </button>
            </div>
          }
        />
        <ChecklistItem
          title="House rules acknowledged"
          description="Confirm house rules are accepted."
          status={checkpoints.houseRulesConfirmed ? "done" : "pending"}
          onToggle={() => updateCheckpoint({ houseRulesConfirmed: !checkpoints.houseRulesConfirmed })}
        />
        <ChecklistItem
          title="ID copy taken"
          description="Confirm ID copy has been received."
          status={checkpoints.idCopyTaken ? "done" : "pending"}
          onToggle={() => updateCheckpoint({ idCopyTaken: !checkpoints.idCopyTaken })}
        />
        <ChecklistItem
          title="Office & lift keys issued"
          description="Confirm keys for the tenant office and lift access are issued."
          status={checkpoints.accessCardsIssued ? "done" : "pending"}
          onToggle={() => updateCheckpoint({ accessCardsIssued: !checkpoints.accessCardsIssued })}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">2) Financial Setup</h2>
        <ChecklistItem
          title="Deposit + first month rent received"
          description="Confirm both the deposit and first month's rent are received."
          status={checkpoints.depositOrGuaranteeConfirmed ? "done" : "pending"}
          onToggle={() =>
            updateCheckpoint({ depositOrGuaranteeConfirmed: !checkpoints.depositOrGuaranteeConfirmed })
          }
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">3) Approval</h2>
        <ChecklistItem
          title="Approve tenant"
          description="Move the company into the main tenant list once all items are complete."
          status={data.org.status === "active" ? "done" : "pending"}
          action={
            <button
              type="button"
              onClick={approveTenant}
              disabled={!canApprove || data.org.status === "active"}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60"
            >
              {data.org.status === "active" ? "Approved" : "Approve tenant"}
            </button>
          }
        />
      </section>

    </div>
  );
}
