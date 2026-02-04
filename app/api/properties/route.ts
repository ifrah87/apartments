import { NextResponse } from "next/server";
import { propertiesRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const data = await propertiesRepo.listProperties();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/properties failed:", err);
    return handleError(err);
  }
}
