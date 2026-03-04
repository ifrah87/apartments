import { Suspense } from "react";
import LeasesClient from "./LeasesClient";

export default function LeasesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LeasesClient />
    </Suspense>
  );
}
