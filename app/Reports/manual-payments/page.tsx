import Link from "next/link";
import ManualPaymentsManager from "@/components/ManualPaymentsManager";
import { listManualPayments } from "@/lib/reports/manualPayments";

export const runtime = "nodejs";

export default async function ManualPaymentsPage() {
  const payments = listManualPayments();

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">
          <Link href="/reports" className="text-indigo-600 hover:underline">
            Reports
          </Link>{" "}
          / Manual Payments
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Manual Payments</h1>
        <p className="text-sm text-slate-500">
          Record tenant receipts that do not appear in the bank CSV so tenant ledgers stay accurate.
        </p>
      </header>

      <ManualPaymentsManager initialPayments={payments} />
    </div>
  );
}
