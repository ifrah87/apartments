import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";

export const runtime = "nodejs";

export default async function ManualPaymentsPage() {
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
        <p className="text-sm text-slate-500">Manual payment entry is disabled.</p>
      </header>

      <SectionCard className="p-6 text-sm text-slate-600">
        Payments are reconciled via bank sync; manual payments are disabled
      </SectionCard>
    </div>
  );
}
