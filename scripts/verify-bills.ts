import { Client } from "pg";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toMonthIndex(value: string) {
  const idx = MONTHS.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return idx >= 0 ? idx : null;
}

async function postBills(appUrl: string, unitId: string, month: string, year: string) {
  const res = await fetch(`${appUrl}/api/bills?debug=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitIds: [unitId], month, year }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    const message = payload?.error || `Bills API failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

async function main() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const unitId = process.env.UNIT_ID;
  const month = process.env.MONTH || "February";
  const year = process.env.YEAR || "2026";

  if (!unitId) {
    throw new Error("UNIT_ID is required (uuid of the unit to bill).");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to verify invoice persistence.");
  }

  const monthIndex = toMonthIndex(month);
  if (monthIndex === null) {
    throw new Error(`Invalid MONTH: ${month}`);
  }
  const period = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  await postBills(appUrl, unitId, month, year);
  await postBills(appUrl, unitId, month, year);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const invoiceRes = await client.query(
      `SELECT id, total_cents
       FROM public.invoices
       WHERE unit_id = $1 AND period = $2
       ORDER BY id ASC`,
      [unitId, period],
    );
    if (invoiceRes.rows.length !== 1) {
      throw new Error(`Expected 1 invoice for ${unitId}/${period}, found ${invoiceRes.rows.length}.`);
    }
    const invoiceId = String(invoiceRes.rows[0].id);
    const invoiceTotalCents = Number(invoiceRes.rows[0].total_cents || 0);

    const lineRes = await client.query(
      `SELECT description, quantity, unit_price_cents, total_cents, meta
       FROM public.invoice_lines
       WHERE invoice_id = $1
       ORDER BY line_index ASC, created_at ASC`,
      [invoiceId],
    );
    const lines = lineRes.rows;
    if (!lines.length) {
      throw new Error("No invoice_lines found for generated invoice.");
    }

    const meterLine = lines.find((row) => {
      const meta = row.meta || {};
      return meta?.kind === "METER_ELECTRICITY" || String(row.description || "").toLowerCase().includes("electricity");
    });
    if (!meterLine) {
      throw new Error("Missing electricity line item.");
    }

    const meta = meterLine.meta || {};
    if (meta.prev === undefined || meta.cur === undefined || meta.usage === undefined || meta.unit_rate === undefined) {
      throw new Error("Electricity line item meta is missing prev/cur/usage/unit_rate.");
    }

    const expectedLineTotal = Math.round(
      Number(meterLine.quantity || 0) * Number(meterLine.unit_price_cents || 0),
    );
    if (Number(meterLine.total_cents || 0) !== expectedLineTotal) {
      throw new Error("Electricity line total does not match qty * unit_cents.");
    }

    const sumCents = lines.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
    if (sumCents !== invoiceTotalCents) {
      throw new Error("Invoice total_cents does not match sum of line items.");
    }

    console.log("OK: invoice idempotency + electricity line verified.");
    console.log(`invoice_id=${invoiceId} period=${period} total_cents=${invoiceTotalCents}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
