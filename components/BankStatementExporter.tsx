"use client";

type Row = {
  id: string;
  date: string;
  description: string;
  reference: string;
  property: string;
  debit: number;
  credit: number;
  balance: number;
};

function buildCsv(rows: Row[]) {
  const header = ["Date", "Description", "Reference", "Property", "Debit", "Credit", "Balance"];
  const lines = rows.map((row) => [
    row.date,
    row.description.replace(/"/g, '""'),
    row.reference.replace(/"/g, '""'),
    row.property.replace(/"/g, '""'),
    row.debit.toFixed(2),
    row.credit.toFixed(2),
    row.balance.toFixed(2),
  ]);
  return [header, ...lines]
    .map((line) => line.map((cell) => `"${cell}"`).join(","))
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

function exportPdf(rows: Row[], title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const htmlRows = rows
    .map(
      (row) => `
      <tr>
        <td>${row.date}</td>
        <td>${row.description}</td>
        <td>${row.reference}</td>
        <td>${row.property}</td>
        <td style="text-align:right;">${row.debit.toFixed(2)}</td>
        <td style="text-align:right;">${row.credit.toFixed(2)}</td>
        <td style="text-align:right;">${row.balance.toFixed(2)}</td>
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
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th>Property</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export default function BankStatementExporter({ rows, fileName }: { rows: Row[]; fileName: string }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => download(`${fileName}.csv`, buildCsv(rows), "text/csv")}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => exportPdf(rows, fileName)}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        Export PDF
      </button>
    </div>
  );
}
