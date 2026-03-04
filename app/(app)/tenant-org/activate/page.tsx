import { Suspense } from "react";
import TenantOrgActivateClient from "./TenantOrgActivateClient";

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
      <TenantOrgActivateClient />
    </Suspense>
  );
}
