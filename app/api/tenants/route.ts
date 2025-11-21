import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import papa from "papaparse";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "tenants_all_buildings_simple_unique.csv");
    console.log("🔍 reading tenants CSV from:", filePath);

    const csvText = fs.readFileSync(filePath, "utf8");
    console.log("📄 first 200 chars:", csvText.slice(0, 200));

    const parsed = papa.parse(csvText, { header: true });
    const rows = (parsed.data as any[]).filter(Boolean);
    console.log("👤 sample tenant row:", rows[0]);

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("❌ /api/tenants failed:", err);
    return NextResponse.json(
      { error: "Failed to load tenants CSV" },
      { status: 500 }
    );
  }
}
