import { NextResponse } from "next/server";

function maskDatabaseUrl(raw: string) {
  if (!raw) return { masked: "", host: "", dbName: "" };
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const dbName = url.pathname.replace(/^\//, "");
    if (url.password) {
      url.password = "*****";
    }
    return { masked: url.toString(), host, dbName };
  } catch {
    return { masked: raw.replace(/:\/\/.*@/, "://*****@"), host: "", dbName: "" };
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const raw = process.env.DATABASE_URL || "";
  const { masked, host, dbName } = maskDatabaseUrl(raw);
  return NextResponse.json({
    ok: true,
    dbHost: host || null,
    dbName: dbName || null,
    maskedUrl: masked || null,
  });
}
