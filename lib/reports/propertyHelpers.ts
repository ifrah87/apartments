import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import type { PropertyInfo } from "@/lib/reports/rentInsights";

export async function fetchPropertyOptions(): Promise<PropertyInfo[]> {
  const baseUrl = getRequestBaseUrl(headers());
  const res = await fetch(`${baseUrl}/api/properties`, { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const payload = await res.json();
  if (payload?.ok === false) return [];
  return (payload?.ok ? payload.data : payload) as PropertyInfo[];
}
