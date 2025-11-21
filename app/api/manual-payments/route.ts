import { NextRequest, NextResponse } from "next/server";
import { addManualPayment, deleteManualPayment, listManualPayments } from "@/lib/reports/manualPayments";

export async function GET() {
  try {
    return NextResponse.json(listManualPayments());
  } catch (err) {
    console.error("Failed to load manual payments", err);
    return NextResponse.json({ error: "Failed to load manual payments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, amount, date, description } = await req.json();
    if (!tenant_id || !amount || !date) {
      return NextResponse.json({ error: "tenant_id, amount, and date are required" }, { status: 400 });
    }
    const entry = addManualPayment({
      tenant_id: String(tenant_id),
      amount: Number(amount),
      date,
      description,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("Failed to save manual payment", err);
    return NextResponse.json({ error: "Failed to save manual payment" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    deleteManualPayment(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete manual payment", err);
    return NextResponse.json({ error: "Failed to delete manual payment" }, { status: 500 });
  }
}
