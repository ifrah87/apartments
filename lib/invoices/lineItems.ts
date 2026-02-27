import { randomUUID } from "crypto";
import type { StatementRow } from "@/lib/reports/tenantStatement";
import type { InvoiceLineItem, MeterSnapshot } from "@/lib/invoices/types";

const DEFAULT_RATE = 0.41;

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

function toDateString(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function labelForMonth(reference: Date) {
  return reference.toLocaleString("en-GB", { month: "short", year: "numeric" });
}

export function buildInvoiceLineItems(
  rows: StatementRow[],
  reference: Date,
): { lineItems: InvoiceLineItem[]; meterSnapshot: MeterSnapshot | null; totalAmount: number } {
  const lineItems: InvoiceLineItem[] = [];
  let meterSnapshot: MeterSnapshot | null = null;

  rows
    .filter((row) => row.entryType === "charge" && row.charge > 0)
    .forEach((row) => {
      const meta = row.meta as Record<string, unknown> | undefined;
      const kind = String(meta?.kind || "").toLowerCase();
      const meterType = String(meta?.meterType || "").toLowerCase();
      if (kind === "utility") {
        const usage = toNumber(meta?.usage);
        const rate = toNumber(meta?.rate, DEFAULT_RATE);
        const amount = roundMoney(usage * rate);
        const unitLabel = String(meta?.unitLabel || "kWh");
        const metaPayload = {
          kind: "utility",
          meterType: meterType === "water" ? "water" : "electricity",
          prevDate: toDateString(meta?.prevDate),
          prevValue: toNumber(meta?.prevValue),
          currentDate: toDateString(meta?.currentDate),
          currentValue: toNumber(meta?.currentValue),
          usage,
          rate,
          unitLabel,
        };
        lineItems.push({
          id: `utility-${randomUUID()}`,
          description: meterType === "water" ? "Water" : "Electricity",
          qty: usage,
          rate,
          amount,
          meta: metaPayload,
        });

        if (meterType === "electricity") {
          meterSnapshot = {
            prevDate: metaPayload.prevDate,
            prevReading: metaPayload.prevValue,
            currDate: metaPayload.currentDate,
            currReading: metaPayload.currentValue,
            usage,
            rate,
            amount,
            unitLabel,
          };
        }
        return;
      }

      const amount = roundMoney(toNumber(row.charge));
      const description = row.description?.toLowerCase().startsWith("rent for")
        ? `Monthly Rent (${labelForMonth(reference)})`
        : row.description || "Charge";
      lineItems.push({
        id: `line-${randomUUID()}`,
        description,
        qty: 1,
        rate: amount,
        amount,
      });
    });

  const totalAmount = roundMoney(lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0));
  return { lineItems, meterSnapshot, totalAmount };
}
