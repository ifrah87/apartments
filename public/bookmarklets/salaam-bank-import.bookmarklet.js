(() => {
  const PROD_ORIGIN = "https://YOUR-PROD-APP-ORIGIN";
  const isBankDomain = window.location.host.includes("salaambank.so");
  const APP_ORIGIN = isBankDomain ? PROD_ORIGIN : window.location.origin;

  if (!APP_ORIGIN || APP_ORIGIN.includes("YOUR-PROD-APP-ORIGIN")) {
    alert("Please set PROD_ORIGIN in the bookmarklet before running.");
    return;
  }

  const normalizeHeader = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const parseDate = (value) => {
    const match = String(value || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  };

  const parseNumber = (value) => {
    const cleaned = String(value || "")
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/[^0-9.-]/g, "");
    if (!cleaned || cleaned === "-") return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const findStatementTable = () => {
    const tables = Array.from(document.querySelectorAll("table"));
    const expected = ["date", "ref", "branch", "particulars", "chequeno", "withdrawal", "deposit", "balance"];

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (!rows.length) continue;

      const headerRow = rows.find((row) => row.querySelectorAll("th").length > 0) || rows[0];
      const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
      const headers = headerCells.map((cell) => normalizeHeader(cell.textContent));

      const matches = expected.filter((key) => headers.includes(key));
      if (matches.length >= 5 && headers.includes("date") && headers.includes("balance")) {
        return { table, headers, headerRow };
      }
    }

    return null;
  };

  const readAccount = () => {
    const selectors = [
      "#Account",
      "#account",
      "[name*=Account]",
      "[id*=Account]",
      "[name*=account]",
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if ("value" in el && String(el.value).trim()) return String(el.value).trim();
      if (el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return null;
  };

  const statement = findStatementTable();
  if (!statement) {
    alert("Could not find the statement table on this page.");
    return;
  }

  const rows = Array.from(statement.table.querySelectorAll("tr"));
  const headerIndex = rows.indexOf(statement.headerRow);
  const dataRows = rows.slice(headerIndex + 1);

  const transactions = [];
  for (const row of dataRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (!cells.length) continue;

    const values = cells.map((cell) => cell.textContent?.trim() ?? "");
    const rowData = {};

    statement.headers.forEach((header, index) => {
      rowData[header] = values[index] ?? "";
    });

    const date = parseDate(rowData.date);
    if (!date) continue;

    transactions.push({
      date,
      ref: rowData.ref || null,
      branch: rowData.branch || null,
      particulars: rowData.particulars || null,
      chequeNo: rowData.chequeno || null,
      withdrawal: parseNumber(rowData.withdrawal),
      deposit: parseNumber(rowData.deposit),
      balance: parseNumber(rowData.balance),
    });
  }

  if (!transactions.length) {
    alert("No transactions found to import.");
    return;
  }

  const payload = {
    source: "bookmarklet",
    pageUrl: window.location.href,
    account: readAccount() || undefined,
    transactions,
  };

  fetch(`${APP_ORIGIN}/api/banking/bookmarklet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error || "Import failed.";
        throw new Error(message);
      }
      return data;
    })
    .then((data) => {
      alert(`Imported ${data.imported}, skipped ${data.skipped}`);
    })
    .catch((err) => {
      alert(`Import failed: ${err.message}`);
    });
})();
