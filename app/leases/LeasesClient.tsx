"use client";

import { useSearchParams } from "next/navigation";

export default function LeasesClient() {
  const searchParams = useSearchParams();

  // TODO: Move all existing page content here
  // This component receives search params and renders the leases UI

  return (
    <div>
      {/* Existing leases page content goes here */}
      {/* Access search params via: searchParams.get("paramName") */}
    </div>
  );
}
