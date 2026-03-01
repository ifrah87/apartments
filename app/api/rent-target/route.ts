import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo } from "@/lib/repos";

export const runtime = "nodejs";

const DATASET_KEY = "rent-monthly-target";
const DEFAULT_TARGET = 37350;

function handleError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET() {
  try {
    const target = await datasetsRepo.getDataset<number>(DATASET_KEY, DEFAULT_TARGET);
    return NextResponse.json({ ok: true, target: typeof target === "number" ? target : DEFAULT_TARGET });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const value = Number(body?.target);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ ok: false, error: "target must be a non-negative number." }, { status: 400 });
    }
    await datasetsRepo.setDataset<number>(DATASET_KEY, value);
    return NextResponse.json({ ok: true, target: value });
  } catch (err) {
    return handleError(err);
  }
}
