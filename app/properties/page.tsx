import { Suspense } from "react";
import PropertiesClient from "./PropertiesClient";

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-300">Loading…</div>}>
      <PropertiesClient />
    </Suspense>
  );
}
