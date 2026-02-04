export type RentReminderInput = {
  name?: string;
  monthlyRent?: string | number;
  dueDay?: string | number;
  locale?: string;
  referenceDate?: Date;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : fallback;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function resolveDueDate(dueDay: string | number | undefined, referenceDate: Date) {
  const parsed = Number(dueDay);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const maxDay = daysInMonth(year, month);
  const day = Math.min(Math.floor(parsed), maxDay);
  return new Date(year, month, day);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function buildRentReminderBody({
  name,
  monthlyRent,
  dueDay,
  locale = "en-US",
  referenceDate = new Date(),
}: RentReminderInput) {
  const tenantName = name?.trim() || "tenant";
  const amount = formatCurrency(toNumber(monthlyRent));
  const dueDate = resolveDueDate(dueDay, referenceDate);
  const dueLabel = dueDate
    ? dueDate.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
    : "this month";

  return `Hi ${tenantName}, this is a gentle reminder that your rent of ${amount} was due on ${dueLabel}. Please pay at your earliest convenience. Thanks!`;
}

export function isPastGracePeriod({
  dueDay,
  referenceDate = new Date(),
  graceDays = 3,
}: {
  dueDay?: string | number;
  referenceDate?: Date;
  graceDays?: number;
}) {
  const dueDate = resolveDueDate(dueDay, referenceDate);
  if (!dueDate) return false;
  const cutoff = new Date(dueDate);
  cutoff.setDate(cutoff.getDate() + graceDays);
  return referenceDate >= cutoff;
}
