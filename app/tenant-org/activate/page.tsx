"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function TenantOrgActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing activation token.");
      return;
    }

    fetch("/api/tenant-org/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          throw new Error(data?.error || "Activation failed.");
        }
        router.replace("/tenant-org/dashboard");
      })
      .catch((err) => setError(err?.message || "Activation failed."));
  }, [token, router]);

  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold text-slate-900">Activating your portal</h1>
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <p className="text-sm text-slate-600">One moment while we activate your account.</p>
      )}
    </div>
  );
}

export default function TenantOrgActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Activating your portal</h1>
          <p className="text-sm text-slate-600">One moment while we activate your account.</p>
        </div>
      }
    >
      <TenantOrgActivateContent />
    </Suspense>
  );
}
