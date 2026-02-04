import { NextRequest, NextResponse } from "next/server";
import { RepoError, unitsRepo } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const data = await unitsRepo.listUnits({ propertyId });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/units failed:", err);
    return handleError(err);
  }
}
