import { Suspense } from "react";
import ReadingsClient from "./ReadingsClient";

export default function ReadingsPage() {
  return (
    <Suspense fallback={null}>
      <ReadingsClient />
    </Suspense>
  );
}
