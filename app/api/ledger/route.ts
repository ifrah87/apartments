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

    const transactions = await bankTransactionsRepo.listTransactions({ start, end, propertyId });
    const normalized = transactions.map((txn) => ({
      ...txn,
      reference: txn.reference ?? "",
      unit: "",
      type: txn.type ?? (txn.amount >= 0 ? "credit" : "debit"),
      raw: txn,
    }));

    return NextResponse.json({ ok: true, data: normalized });
  } catch (err) {
    console.error("❌ /api/ledger failed:", err);
    return handleError(err);
  }
}
