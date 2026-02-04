import { NextRequest, NextResponse } from "next/server";
import { meterReadingsRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unit = searchParams.get("unit") ?? undefined;
    const meterType = searchParams.get("meterType") ?? undefined;

    const data = await meterReadingsRepo.listReadings({ unit, meterType });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/meter-readings failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = await meterReadingsRepo.createReading(payload);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/meter-readings POST failed:", err);
    return handleError(err);
  }
}
