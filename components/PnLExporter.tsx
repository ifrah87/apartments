"use client";

import { PropertyPnL } from "@/lib/reports/pnl";

function buildCsv(property: PropertyPnL) {
  const header = ["Account", "Type", "Amount"];
  const lines = property.accounts.map((account) => [account.accountName, account.type, account.amount.toFixed(2)]);
  return [header, ...lines]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPdf(property: PropertyPnL, title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const rows = property.accounts
    .map(
      (account) => `
        <tr>
          <td>${account.accountName}</td>
          <td>${account.type}</td>
          <td style="text-align:right;">${account.amount.toFixed(2)}</td>
        </tr>
      `,
    )
    .join("");
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px; font-size: 12px; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export default function PnLExporter({ property, fileName }: { property: PropertyPnL; fileName: string }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => download(`${fileName}.csv`, buildCsv(property), "text/csv")}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => exportPdf(property, fileName)}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        Export PDF
      </button>
    </div>
  );
}
