import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import papa from "papaparse";

export const runtime = "nodejs";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "properties_all_buildings.csv");
    const csvText = fs.readFileSync(filePath, "utf8");
    const parsed = papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = (parsed.data as any[]).filter(Boolean);

    // 🔁 normalize: building -> name, units -> total_units
    const normalized = rows.map(r => ({
      property_id: r.property_id ?? r.id ?? "",
      name: r.name ?? r.building ?? "",           // <— UI expects `name`
      address: r.address ?? "",                   // if you add it later
      total_units: Number(r.total_units ?? r.units ?? 0),
      occupied_units: Number(r.occupied_units ?? 0),
      vacant_units: Number(r.vacant_units ?? 0),
    }));

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error("❌ /api/properties failed:", err);
    return NextResponse.json({ error: "Failed to load properties CSV" }, { status: 500 });
  }
}
