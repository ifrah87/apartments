import { NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";

const DATASET_KEY = "tenant_charges";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<any[]>(DATASET_KEY, []);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/tenant-charges failed:", err);
    return handleError(err);
  }
}
