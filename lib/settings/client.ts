import type { SettingsPayload } from "./types";

export type SettingsResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  fields?: Record<string, string>;
};

export async function fetchSettings<T extends SettingsPayload>(key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`/api/settings/${key}`, { cache: "no-store" });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      return fallback;
    }
    return (payload?.ok ? payload.data : payload) as T;
  } catch {
    return fallback;
  }
}

export async function saveSettings<T extends SettingsPayload>(
  key: string,
  payload: T,
): Promise<SettingsResponse<T>> {
  try {
    const res = await fetch(`/api/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      return { ok: false, error: data?.error || "Failed to save settings.", fields: data?.fields };
    }
    return { ok: true, data: (data?.ok ? data.data : data) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save settings." };
  }
}
