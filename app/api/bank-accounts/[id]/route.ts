import { NextRequest, NextResponse } from "next/server";
import { bankAccountsRepo } from "@/src/lib/repos/bankAccountsRepo";
import { RepoError } from "@/src/lib/repos/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const account = await bankAccountsRepo.updateBankAccount(id, body);
    return NextResponse.json({ ok: true, data: account });
  } catch (err) {
    if (err instanceof RepoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to update bank account";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await bankAccountsRepo.deactivateBankAccount(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RepoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to deactivate bank account";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
