import { isUuid } from "@/lib/isUuid";

export function displayPropertyLabel(value?: string | null, fallback = "—") {
  const normalized = String(value || "").trim();
  if (!normalized || isUuid(normalized)) return fallback;
  return normalized;
}
