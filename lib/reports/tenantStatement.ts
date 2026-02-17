export type TenantRecord = {
  id: string;
  name: string;
  property_id?: string;
  building?: string;
  unit?: string;
  reference?: string;
  monthly_rent?: string | number;
  due_day?: string | number;
};

export type StatementRow = {
  date: string;
  description: string;
  charge: number;
  payment: number;
  balance: number;
  entryType: "charge" | "payment";
  source?: string;
};

export type ChargeEntry = {
  date: string;
  amount: number;
  description: string;
  category?: string;
};

export type StatementTotals = {
  charges: number;
  payments: number;
  balance: number;
};

export type PaymentEntry = {
  date: string;
  amount: number;
  description?: string;
  source?: string;
};

export type StatementInput = {
  tenant: TenantRecord;
  start: Date;
  end: Date;
  payments: PaymentEntry[];
  additionalCharges?: ChargeEntry[];
  includeRentCharges?: boolean;
};

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysInMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

function toNumber(value: string | number | undefined | null, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeId(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\.0$/, "");
}

export function buildCharges(tenant: TenantRecord, start: Date, end: Date) {
  const rent = toNumber(tenant.monthly_rent);
  if (!rent) return [];
  const dueDayRaw = toNumber(tenant.due_day, 1);
  const dueDay = dueDayRaw > 0 ? dueDayRaw : 1;
  const entries: PaymentEntry[] = [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= limit) {
    const dim = daysInMonth(cursor);
    const chargeDate = new Date(cursor);
    chargeDate.setUTCDate(Math.min(dueDay, dim));
    if (chargeDate >= start && chargeDate <= end) {
      entries.push({
        date: toISO(chargeDate),
        amount: rent,
        description: `Rent for ${chargeDate.toLocaleString("en", { month: "long", year: "numeric" })}`,
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return entries;
}

export function createStatement({ tenant, start, end, payments, additionalCharges = [], includeRentCharges = true }: StatementInput) {
  const normalizedStart = normalizeDay(start);
  const normalizedEnd = normalizeDay(end);
  if (normalizedStart > normalizedEnd) {
    throw new Error("Start date must be before end date");
  }

  const normalizedCharges = additionalCharges
    .map((charge) => {
      const date = normalizeDay(new Date(charge.date));
      return {
        type: "charge" as const,
        date: toISO(date),
        amount: toNumber(charge.amount),
        description: charge.description || "Charge",
        source: charge.category,
      };
    })
    .filter((charge) => {
      if (!charge.amount) return false;
      const date = new Date(charge.date);
      return date >= normalizedStart && date <= normalizedEnd;
    });

  const rentCharges = includeRentCharges
    ? buildCharges(tenant, normalizedStart, normalizedEnd).map((charge) => ({
        type: "charge" as const,
        ...charge,
      }))
    : [];

  const charges = [...rentCharges, ...normalizedCharges];

  const cleanedPayments = payments
    .map((payment) => ({
      type: "payment" as const,
      date: toISO(normalizeDay(new Date(payment.date))),
      amount: payment.amount,
      description: payment.description || "Payment received",
      source: payment.source,
    }))
    .filter((payment) => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= normalizedStart && paymentDate <= normalizedEnd;
    });

  const combined = [...charges, ...cleanedPayments].sort((a, b) => {
    if (a.date === b.date) {
      if (a.type === b.type) return 0;
      return a.type === "charge" ? -1 : 1;
    }
    return a.date < b.date ? -1 : 1;
  });

  let balance = 0;
  const rows: StatementRow[] = combined.map((row) => {
    if (row.type === "charge") {
      balance += row.amount;
      return {
        date: row.date,
        description: row.description || "Charge",
        charge: row.amount,
        payment: 0,
        balance: Number(balance.toFixed(2)),
        entryType: "charge",
        source: row.source,
      };
    }
    balance -= row.amount;
    return {
      date: row.date,
      description: row.description || "Payment received",
      charge: 0,
      payment: row.amount,
      balance: Number(balance.toFixed(2)),
      entryType: "payment",
      source: row.source,
    };
  });

  const totals: StatementTotals = rows.reduce(
    (acc, row) => {
      acc.charges += row.charge;
      acc.payments += row.payment;
      acc.balance = row.balance;
      return acc;
    },
    { charges: 0, payments: 0, balance: 0 },
  );

  return { rows, totals };
}
