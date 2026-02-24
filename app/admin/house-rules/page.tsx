import { Suspense } from "react";
import HouseRulesClient from "./HouseRulesClient";

export default function AdminHouseRulesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-300">Loading…</div>}>
      <HouseRulesClient />
    </Suspense>
  );
}
