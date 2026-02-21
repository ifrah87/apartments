import { bankTransactionsRepo, datasetsRepo, tenantsRepo } from "@/lib/repos";
import { listManualPayments } from "@/lib/reports/manualPayments";
import { createStatement, normalizeId } from "@/lib/reports/tenantStatement";
import type { TenantRecord as RepoTenantRecord } from "@/lib/repos/tenantsRepo";
import type { LeaseAgreement } from "@/lib/leases";

export type RentLedgerEntry = {
  date: string;
  description: string;
  reference?: string;
  property_id?: string;
  unit?: string;
  amount: number;
  raw?: unknown;
};

export type RentLedgerFilters = {
  start?: string;
  end?: string;
  propertyId?: string;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeKey(value?: string) {
  return (value || "").trim().toLowerCase();
}

function withinRange(date: string, start: Date, end: Date) {
  const parsed = parseDate(date);
  if (!parsed) return false;
  const normalized = normalizeDay(parsed);
  return normalized >= start && normalized <= end;
}

function matchesProperty(tenant: RepoTenantRecord, propertyFilter: string) {
  if (!propertyFilter) return true;
  const key = propertyFilter.toLowerCase();
  return (tenant.property_id || "").toLowerCase() === key || (tenant.building || "").toLowerCase() === key;
}

function buildTenantIndex(tenants: RepoTenantRecord[]) {
  const byId = new Map<string, RepoTenantRecord>();
  const byUnit = new Map<string, RepoTenantRecord>();
  tenants.forEach((tenant) => {
    const id = normalizeId(tenant.id);
    if (id) byId.set(id, tenant);
    const unit = normalizeKey(tenant.unit || "");
    if (!unit) return;
    const property = normalizeKey(tenant.property_id || tenant.building || "");
    if (property) byUnit.set(`${property}::${unit}`, tenant);
    byUnit.set(`::${unit}`, tenant);
  });
  return { byId, byUnit };
}

function findTenantForLease(lease: LeaseAgreement, index: ReturnType<typeof buildTenantIndex>) {
  const unit = normalizeKey(lease.unit);
  if (!unit) return null;
  const property = normalizeKey(lease.property || "");
  return index.byUnit.get(`${property}::${unit}`) || index.byUnit.get(`::${unit}`) || null;
}

export async function buildRentLedger(filters: RentLedgerFilters = {}): Promise<RentLedgerEntry[]> {
  const today = new Date();
  const startDate = parseDate(filters.start) || new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = parseDate(filters.end) || new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const start = normalizeDay(startDate);
  const end = normalizeDay(endDate);
  const propertyFilter = (filters.propertyId || "").trim().toLowerCase();

  const [tenants, leases, manualPayments, bankTransactions] = await Promise.all([
    tenantsRepo.listTenants(),
    datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []),
    listManualPayments(),
    bankTransactionsRepo.listTransactions({ start: toISO(start), end: toISO(end) }),
  ]);

  const relevantTenants = tenants.filter((tenant) => matchesProperty(tenant, propertyFilter));
  const tenantIndex = buildTenantIndex(relevantTenants);

  const chargeEntries: RentLedgerEntry[] = [];
  relevantTenants.forEach((tenant) => {
    if (!tenant.monthly_rent) return;
    const { rows } = createStatement({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        property_id: tenant.property_id ?? undefined,
        building: tenant.building ?? undefined,
        unit: tenant.unit ?? undefined,
        reference: tenant.reference ?? undefined,
        monthly_rent: tenant.monthly_rent ?? undefined,
        due_day: tenant.due_day ?? undefined,
      },
      start,
      end,
      payments: [],
      additionalCharges: [],
    });
    rows
      .filter((row) => row.entryType === "charge" && row.charge > 0)
      .forEach((row) => {
        chargeEntries.push({
          date: row.date,
          description: `${row.description} • ${tenant.name}`,
          property_id: tenant.property_id || tenant.building || undefined,
          unit: tenant.unit || undefined,
          reference: tenant.reference || tenant.unit || tenant.name,
          amount: -Math.abs(row.charge),
          raw: { source: "rent", tenantId: tenant.id },
        });
      });
  });

  const depositEntries: RentLedgerEntry[] = leases
    .filter((lease) => lease && lease.deposit && lease.deposit > 0 && lease.status !== "Terminated")
    .reduce<RentLedgerEntry[]>((acc, lease) => {
      const tenant = findTenantForLease(lease, tenantIndex);
      if (propertyFilter && !tenant && normalizeKey(lease.property || "") !== propertyFilter) return acc;
      const dateValue = parseDate(lease.startDate) || start;
      if (dateValue < start || dateValue > end) return acc;
      const tenantName = tenant?.name || lease.tenantName || "Tenant";
      const unit = lease.unit || tenant?.unit || "";
      acc.push({
        date: toISO(dateValue),
        description: `Security deposit • ${tenantName}${unit ? ` (Unit ${unit})` : ""}`,
        property_id: tenant?.property_id || tenant?.building || lease.property || undefined,
        unit: unit || undefined,
        reference: tenant?.reference || unit || tenantName,
        amount: -Math.abs(Number(lease.deposit || 0)),
        raw: { source: "deposit", leaseId: lease.id },
      });
      return acc;
    }, []);

  const manualEntries: RentLedgerEntry[] = manualPayments
    .filter((entry) => withinRange(entry.date, start, end))
    .map((entry) => {
      const tenant = tenantIndex.byId.get(normalizeId(entry.tenant_id));
      if (!tenant) return null;
      return {
        date: entry.date,
        description: entry.description || `Manual payment • ${tenant.name}`,
        property_id: tenant.property_id || tenant.building || undefined,
        unit: tenant.unit || undefined,
        reference: tenant.reference || tenant.unit || tenant.name,
        amount: Number(entry.amount || 0),
        raw: { source: "manual", tenantId: tenant.id },
      } satisfies RentLedgerEntry;
    })
    .filter((entry): entry is RentLedgerEntry => Boolean(entry));

  const bankEntries: RentLedgerEntry[] = bankTransactions
    .map((txn) => {
      const explicitTenantId = normalizeId(txn.tenant_id || txn.matched_tenant_id || "");
      let tenant = explicitTenantId ? tenantIndex.byId.get(explicitTenantId) : undefined;
      if (!tenant) {
        const desc = (txn.description || "").toLowerCase();
        tenant = relevantTenants.find((candidate) => {
          if (candidate.name && desc.includes(candidate.name.toLowerCase())) return true;
          if (candidate.unit && desc.includes(candidate.unit.toLowerCase())) return true;
          if (candidate.reference && desc.includes(candidate.reference.toLowerCase())) return true;
          return false;
        });
      }
      if (!tenant) return null;
      return {
        date: txn.date,
        description: txn.description || `Payment • ${tenant.name}`,
        property_id: tenant.property_id || tenant.building || txn.property_id || undefined,
        unit: tenant.unit || undefined,
        reference: tenant.reference || tenant.unit || tenant.name,
        amount: Number(txn.amount || 0),
        raw: { source: "bank", txnId: txn.id },
      } satisfies RentLedgerEntry;
    })
    .filter((entry): entry is RentLedgerEntry => Boolean(entry));

  return [...chargeEntries, ...depositEntries, ...manualEntries, ...bankEntries];
}
