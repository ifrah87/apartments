import { NextRequest, NextResponse } from "next/server";
import { bankAccountsRepo } from "@/src/lib/repos/bankAccountsRepo";
import { RepoError } from "@/src/lib/repos/errors";

export async function GET() {
  try {
    const accounts = await bankAccountsRepo.getAllBankAccounts();
    return NextResponse.json({ ok: true, data: accounts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch bank accounts";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = await bankAccountsRepo.createBankAccount(body);
    return NextResponse.json({ ok: true, data: account }, { status: 201 });
  } catch (err) {
    if (err instanceof RepoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to create bank account";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
