"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/utils/exportCsv";

type Props = {
  getData: () => Record<string, unknown>[];
  filename: string;
};

export default function ExportButton({ getData, filename }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCsv = () => {
    downloadCsv(getData(), filename);
    setOpen(false);
  };

  const handlePrint = () => {
    const data = getData();
    if (!data.length) { setOpen(false); return; }
    const headers = Object.keys(data[0]);
    const headerRow = headers.map((h) => `<th>${h}</th>`).join("");
    const bodyRows = data
      .map(
        (row) =>
          `<tr>${headers.map((h) => `<td>${String(row[h] ?? "")}</td>`).join("")}</tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #111; }
  h2 { margin-bottom: 12px; text-transform: capitalize; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  @media print { body { margin: 0; } }
</style></head><body>
<h2>${filename}</h2>
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { setOpen(false); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/20 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-xl">
          <button
            type="button"
            onClick={handleCsv}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Export as Excel / CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/5"
          >
            <Printer className="h-4 w-4 text-blue-400" />
            Print / Save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
