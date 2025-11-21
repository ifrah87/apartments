import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import papa from "papaparse";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "bank_balances.csv");
    const csvText = fs.readFileSync(filePath, "utf8");
    const parsed = papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data as any[]).filter(Boolean);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ failed to load bank balances", err);
    return NextResponse.json({ error: "Failed to load bank balances" }, { status: 500 });
  }
}
