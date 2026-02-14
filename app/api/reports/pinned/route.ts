import { NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";

const DATASET_KEY = "reports_pins";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const pinned = await datasetsRepo.getDataset<string[]>(DATASET_KEY, []);
    return NextResponse.json({ ok: true, pinned: Array.isArray(pinned) ? pinned : [] });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const pinned = Array.isArray(payload?.pinned)
      ? payload.pinned.map((item: unknown) => String(item))
      : [];
    await datasetsRepo.setDataset(DATASET_KEY, pinned);
    return NextResponse.json({ ok: true, pinned });
  } catch (err) {
    return handleError(err);
  }
}
