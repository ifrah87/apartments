import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";
import { getSettingsMeta, normalizeSettings, type SettingsKey } from "@/lib/settings/server";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const meta = getSettingsMeta(key);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "Unknown settings key." }, { status: 404 });
    }
    const raw = await datasetsRepo.getDataset(meta.key, meta.defaults);
    const normalized = normalizeSettings(key as SettingsKey, raw, false);
    return NextResponse.json({ ok: true, data: normalized.value });
  } catch (err) {
    console.error("❌ failed to load settings", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const meta = getSettingsMeta(key);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "Unknown settings key." }, { status: 404 });
    }
    const payload = await req.json();
    const normalized = normalizeSettings(key as SettingsKey, payload, true);
    if (Object.keys(normalized.errors).length) {
      return NextResponse.json(
        { ok: false, error: "Validation failed.", fields: normalized.errors },
        { status: 400 },
      );
    }
    await datasetsRepo.setDataset(meta.key, normalized.value);
    return NextResponse.json({ ok: true, data: normalized.value });
  } catch (err) {
    console.error("❌ failed to save settings", err);
    return handleError(err);
  }
}
