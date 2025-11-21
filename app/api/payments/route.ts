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

    const normalized = rows.map((r) => ({
      date: r.date,
      description: r.description,
      amount: Number(r.amount || 0),
      type: r.type,
      property_id: r.property_id,
      tenant_id: r.tenant_id,
    }));

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("❌ /api/payments failed:", err);
    return NextResponse.json(
      { error: "Failed to load payments CSV" },
      { status: 500 }
    );
  }
}
