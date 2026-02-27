import { NextRequest, NextResponse } from "next/server";
import { bankTransactionsRepo, RepoError } from "@/lib/repos";
import { normalizeId } from "@/lib/normalizeId";
import { isUuid } from "@/lib/isUuid";

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
    const tenantIdRaw = searchParams.get("tenantId"); // string | null

    const tenantIdNormalized =
      tenantIdRaw && tenantIdRaw.trim() !== ""
        ? normalizeId(tenantIdRaw)
        : undefined;

    if (tenantIdNormalized && !isUuid(tenantIdNormalized)) {
      return NextResponse.json({ ok: false, error: `Invalid tenant_id: ${tenantIdRaw}` }, { status: 400 });
    }

    const transactions = await bankTransactionsRepo.listTransactions({
      start,
      end,
      propertyId,
      tenantId: tenantIdNormalized,
    });
    const normalized = transactions.map((txn) => ({
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      type: txn.type ?? (txn.amount >= 0 ? "credit" : "debit"),
      property_id: txn.property_id,
      tenant_id: txn.tenant_id,
    }));

    return NextResponse.json({ ok: true, data: normalized });
  } catch (err) {
    console.error("❌ /api/payments failed:", err);
    return handleError(err);
  }
}
