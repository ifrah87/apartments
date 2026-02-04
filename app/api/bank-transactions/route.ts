import { NextRequest, NextResponse } from "next/server";
import { bankTransactionsRepo, RepoError } from "@/lib/repos";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;
    const propertyId = searchParams.get("propertyId") ?? undefined;
    const tenantId = searchParams.get("tenantId") ?? undefined;
    const type = searchParams.get("type") ?? undefined;

    const data = await bankTransactionsRepo.listTransactions({ start, end, propertyId, tenantId, type });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ /api/bank-transactions failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = await bankTransactionsRepo.createTransaction(payload);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/bank-transactions POST failed:", err);
    return handleError(err);
  }
}
