import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";

const DATASET_KEY = "month_end_tasks";

const DEFAULT_TASKS = [
  { task: "Generate rent invoices for all active leases",       category: "Billing",       order: 1 },
  { task: "Enter electricity meter readings for all units",     category: "Utilities",     order: 2 },
  { task: "Review and confirm all invoice line items",          category: "Billing",       order: 3 },
  { task: "Send invoices to tenants (WhatsApp / email)",        category: "Billing",       order: 4 },
  { task: "Import bank statement CSV",                          category: "Banking",       order: 5 },
  { task: "Match bank transactions to invoices",                category: "Banking",       order: 6 },
  { task: "Check for duplicate payments",                       category: "Banking",       order: 7 },
  { task: "Review arrears aging report (30d / 60d)",            category: "Collections",   order: 8 },
  { task: "Chase tenants with balances over 30 days",           category: "Collections",   order: 9 },
  { task: "Reconcile bank balance vs book balance",             category: "Reconciliation",order: 10 },
  { task: "Confirm DigitalOcean DB backup ran successfully",    category: "Admin",         order: 11 },
  { task: "Review occupancy — note any vacant units",           category: "Admin",         order: 12 },
];

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? "";
    const stored = await datasetsRepo.getDataset<any[]>(DATASET_KEY, []);

    // Build per-month completion map from stored records
    const completionMap = new Map<string, boolean>();
    if (Array.isArray(stored)) {
      stored
        .filter((row) => !month || row.month === month)
        .forEach((row) => {
          const key = `${row.month ?? ""}::${row.task}`;
          completionMap.set(key, String(row.completed ?? "").toLowerCase() === "true");
        });
    }

    const tasks = DEFAULT_TASKS.map((t) => ({
      month,
      task:      t.task,
      category:  t.category,
      order:     t.order,
      completed: completionMap.get(`${month}::${t.task}`) ?? false,
    }));

    return NextResponse.json({ ok: true, data: tasks });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { month, task, completed } = await req.json();
    if (!month || !task) {
      return NextResponse.json({ ok: false, error: "month and task are required" }, { status: 400 });
    }
    await datasetsRepo.updateDataset<any[]>(
      DATASET_KEY,
      (current) => {
        const rows = Array.isArray(current) ? current : [];
        const idx = rows.findIndex((r) => r.month === month && r.task === task);
        const entry = { month, task, completed: String(completed ?? false) };
        if (idx >= 0) {
          rows[idx] = entry;
          return [...rows];
        }
        return [...rows, entry];
      },
      [],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
