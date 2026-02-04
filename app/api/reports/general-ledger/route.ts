import { NextResponse } from "next/server";
import { buildGeneralLedger } from "@/lib/reports/accountingReports";

export const runtime = "nodejs";

function csvValue(value: string | number) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const propertyId = searchParams.get("propertyId") || "";
  const accountCode = searchParams.get("accountCode") || "";

  const rows = await buildGeneralLedger({
    propertyId: propertyId && propertyId !== "all" ? propertyId : undefined,
    start: from || undefined,
    end: to || undefined,
    accountId: accountCode || undefined,
  });

  let runningBalance = 0;
  const lines = [
    ["Date", "Entry", "Account", "Description", "Debit", "Credit", "Running balance"].map(csvValue).join(","),
    ...rows.map((row) => {
      runningBalance += row.debit - row.credit;
      return [
        csvValue(row.date),
        csvValue(row.entryId),
        csvValue(row.accountName),
        csvValue(row.description || ""),
        csvValue(row.debit.toFixed(2)),
        csvValue(row.credit.toFixed(2)),
        csvValue(runningBalance.toFixed(2)),
      ].join(",");
    }),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="general-ledger-${from || "all"}-${to || "all"}.csv"`,
    },
  });
}
