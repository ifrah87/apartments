function pad2(value: number) {
  return String(value).padStart(2, "0");
}

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export function parseDateOnly(value: string | null | undefined): DateParts | null {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function toDateOnlyString(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const parsed = parseDateOnly(trimmed);
  if (parsed) {
    return `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function dateOnlyToUtcTimestamp(value: string | Date | null | undefined) {
  const parts = parseDateOnly(toDateOnlyString(value));
  if (!parts) return Number.NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const timestamp = dateOnlyToUtcTimestamp(value);
  if (Number.isNaN(timestamp)) return String(value || "");
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(timestamp));
}

export function formatDateOnlyMonthYear(value: string | Date | null | undefined, locale = "en-GB") {
  const parsed = parseDateOnly(toDateOnlyString(value));
  if (!parsed) return "—";
  return formatDateOnly(`${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`, locale, {
    month: "long",
    year: "numeric",
  });
}

export function toPeriodKeyFromDateOnly(value: string | Date | null | undefined) {
  const parts = parseDateOnly(toDateOnlyString(value));
  if (!parts) return "";
  return `${parts.year}-${pad2(parts.month)}`;
}
