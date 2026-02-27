export function normalizeId(input: unknown): string {
  const s = String(input ?? "").trim();

  // Extract first UUID anywhere in the string (handles: tenant-<uuid>-102)
  const match = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : s;
}
