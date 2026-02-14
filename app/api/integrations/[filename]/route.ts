import { NextRequest } from "next/server";
import { DATA_FILE_SET } from "@/lib/dataFiles";
import { datasetsRepo } from "@/lib/repos";

function buildCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  });
  return lines.join("\n");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const rawName = filename || "";
  const decoded = decodeURIComponent(rawName);
  if (
    !decoded ||
    decoded.includes("..") ||
    decoded.includes("/") ||
    !decoded.toLowerCase().endsWith(".csv") ||
    !DATA_FILE_SET.has(decoded)
  ) {
    return new Response("Invalid file name", { status: 400 });
  }

  try {
    const datasetKey = decoded.replace(/\.csv$/i, "");
    const rows = await datasetsRepo.getDataset<Record<string, unknown>[]>(datasetKey, []);
    const csv = buildCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${decoded}"`,
      },
    });
  } catch (error) {
    console.error("Failed to read dataset", error);
    return new Response("File not found", { status: 404 });
  }
}
