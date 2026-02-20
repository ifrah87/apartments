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

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = await unitsRepo.createUnit(payload);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/units POST failed:", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    const data = await unitsRepo.updateUnit(String(payload.id), payload);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/units PUT failed:", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    await unitsRepo.deleteUnit(String(payload.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ /api/units DELETE failed:", err);
    return handleError(err);
  }
}
