import { getRequestBaseUrl } from "@/lib/utils/baseUrl";
import type { PropertyInfo } from "@/lib/reports/rentInsights";

export async function fetchPropertyOptions(): Promise<PropertyInfo[]> {
  const baseUrl = await getRequestBaseUrl();
  const res = await fetch(`${baseUrl}/api/properties`, { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const payload = await res.json();
  if (payload?.ok === false) return [];
  const data = (payload?.ok ? payload.data : payload) as Array<{
    id: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  }>;
  if (!Array.isArray(data)) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: row.name ?? undefined,
    code: row.code ?? undefined,
    status: row.status ?? undefined,
  })) as PropertyInfo[];
}
