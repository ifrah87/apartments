import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Lease id is required." }, { status: 400 });
  }
  await query("DELETE FROM public.leases WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
