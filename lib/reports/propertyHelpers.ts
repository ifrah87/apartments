import { buildApiUrl } from "@/lib/utils/baseUrl";
import type { PropertyInfo } from "@/lib/reports/rentInsights";

export async function fetchPropertyOptions(): Promise<PropertyInfo[]> {
  const res = await fetch(buildApiUrl("/api/properties"), { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  return res.json();
}
