export const opt = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined ? undefined : value;
