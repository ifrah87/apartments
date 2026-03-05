import { NextResponse } from "next/server";
import { listPropertySummaries } from "@/lib/repos/propertiesRepo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await listPropertySummaries();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/properties/summaries failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
