import { Suspense } from "react";
import UnitsClient from "./UnitsClient";

export default function UnitsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-300">Loading…</div>}>
      <UnitsClient />
    </Suspense>
  );
}
