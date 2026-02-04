import { tenantsRepo } from "./tenantsRepo";
import { unitsRepo } from "./unitsRepo";
import { bankTransactionsRepo } from "./bankTransactionsRepo";
import { meterReadingsRepo } from "./meterReadingsRepo";
import { propertiesRepo } from "./propertiesRepo";
import { datasetsRepo } from "./datasetsRepo";

const backend = (process.env.DATA_BACKEND || "db").toLowerCase();
if (backend !== "db") {
  console.warn(`[repos] DATA_BACKEND=${backend} is not supported. Falling back to db.`);
}

export {
  tenantsRepo,
  unitsRepo,
  bankTransactionsRepo,
  meterReadingsRepo,
  propertiesRepo,
  datasetsRepo,
};

export { RepoError, badRequest, notFound } from "./errors";
export type { TenantRecord } from "./tenantsRepo";
export type { UnitRecord } from "./unitsRepo";
export type { BankTransaction } from "./bankTransactionsRepo";
export type { MeterReading } from "./meterReadingsRepo";
export type { PropertyRecord } from "./propertiesRepo";
export type { DatasetKey } from "./datasetsRepo";
