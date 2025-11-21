import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import papa from "papaparse";

export async function GET() {
  try {
    // 1. point to CSV
    const filePath = path.join(
      process.cwd(),
      "data",
      "units_master_66.csv"
    );

    // 2. read file
    const csvText = fs.readFileSync(filePath, "utf8");

    // 3. parse CSV -> objects
    const parsed = papa.parse(csvText, { header: true });
    const rows = (parsed.data as any[]).filter(Boolean);

    // 4. return rows as JSON
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ /api/units failed:", err);
    return NextResponse.json(
      { error: "Failed to load units CSV" },
      { status: 500 }
    );
  }
}
