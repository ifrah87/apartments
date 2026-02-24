const STORAGE_KEY = "currentPropertyId";

export function getCurrentPropertyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setCurrentPropertyId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function resolveCurrentPropertyId<T extends { id: string; status?: string | null }>(
  properties: T[],
): string | null {
  if (typeof window === "undefined") return null;
  const stored = getCurrentPropertyId();
  if (stored && properties.some((p) => p.id === stored)) {
    return stored;
  }
  const active = properties.find((p) => (p.status || "active") === "active") || properties[0];
  if (!active) return null;
  setCurrentPropertyId(active.id);
  return active.id;
}
