import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import papa from "papaparse";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "bank_all_buildings_simple.csv");
    const csvText = fs.readFileSync(filePath, "utf8");
    const parsed = papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data as any[]).filter(Boolean);

    const normalized = rows.map((row, idx) => {
      const description = row.description || "";
      const refMatch = description.match(/REF:([A-Za-z0-9-]+)/i);
      const unitMatch = description.match(/#(\d+)/);
      const amount = Number(row.amount || 0);
      return {
        id: row.id || idx,
        date: row.date,
        description,
        reference: row.reference || (refMatch ? refMatch[1] : ""),
        property_id: row.property_id,
        tenant_id: row.tenant_id,
        unit: row.unit || (unitMatch ? unitMatch[1] : ""),
        amount,
        type: row.type || (amount >= 0 ? "credit" : "debit"),
        raw: row,
      };
    });

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("❌ /api/ledger failed:", err);
    return NextResponse.json({ error: "Failed to load ledger CSV" }, { status: 500 });
  }
}
