import { NextRequest, NextResponse } from "next/server";
import { getTransactionCategories, setTransactionCategory } from "@/lib/reports/categoryStore";

export async function GET() {
  try {
    const data = await getTransactionCategories();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("Failed to read transaction categories", err);
    return NextResponse.json({ ok: false, error: "Failed to read categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id || "").trim();
    const accountId = String(body?.accountId || "").trim();
    if (!id || !accountId) {
      return NextResponse.json({ ok: false, error: "id and accountId are required" }, { status: 400 });
    }
    await setTransactionCategory(id, accountId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update transaction category", err);
    return NextResponse.json({ ok: false, error: "Failed to update category" }, { status: 500 });
  }
}
