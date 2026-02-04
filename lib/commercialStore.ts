import { readJsonFile, updateJsonFile } from "@/lib/storage/jsonStore";
import type {
  CommercialDocument,
  FacilitiesTicket,
  Invoice,
  LeaseCommercial,
  Notice,
  OnboardingCheckpointsCommercial,
  TenantOrg,
} from "@/lib/commercial";

const ORGS_FILE = "tenant_orgs.json";
const LEASES_FILE = "leases_commercial.json";
const ONBOARDING_FILE = "onboarding_commercial.json";
const INVOICES_FILE = "invoices.json";
const DOCUMENTS_FILE = "documents.json";
const TICKETS_FILE = "facilities_tickets.json";
const NOTICES_FILE = "notices.json";

export async function getTenantOrgs() {
  return readJsonFile<TenantOrg[]>(ORGS_FILE, []);
}

export async function getCommercialLeases() {
  return readJsonFile<LeaseCommercial[]>(LEASES_FILE, []);
}

export async function getCommercialCheckpoints() {
  return readJsonFile<OnboardingCheckpointsCommercial[]>(ONBOARDING_FILE, []);
}

export async function getCommercialInvoices() {
  return readJsonFile<Invoice[]>(INVOICES_FILE, []);
}

export async function getCommercialDocuments() {
  return readJsonFile<CommercialDocument[]>(DOCUMENTS_FILE, []);
}

export async function getFacilitiesTickets() {
  return readJsonFile<FacilitiesTicket[]>(TICKETS_FILE, []);
}

export async function getNotices() {
  return readJsonFile<Notice[]>(NOTICES_FILE, []);
}

export async function updateTenantOrgs(updater: (items: TenantOrg[]) => TenantOrg[]) {
  return updateJsonFile<TenantOrg[]>(ORGS_FILE, updater, []);
}

export async function updateCommercialLeases(updater: (items: LeaseCommercial[]) => LeaseCommercial[]) {
  return updateJsonFile<LeaseCommercial[]>(LEASES_FILE, updater, []);
}

export async function updateCommercialCheckpoints(
  updater: (items: OnboardingCheckpointsCommercial[]) => OnboardingCheckpointsCommercial[],
) {
  return updateJsonFile<OnboardingCheckpointsCommercial[]>(ONBOARDING_FILE, updater, []);
}

export async function updateCommercialInvoices(updater: (items: Invoice[]) => Invoice[]) {
  return updateJsonFile<Invoice[]>(INVOICES_FILE, updater, []);
}

export async function updateCommercialDocuments(updater: (items: CommercialDocument[]) => CommercialDocument[]) {
  return updateJsonFile<CommercialDocument[]>(DOCUMENTS_FILE, updater, []);
}

export async function updateFacilitiesTickets(updater: (items: FacilitiesTicket[]) => FacilitiesTicket[]) {
  return updateJsonFile<FacilitiesTicket[]>(TICKETS_FILE, updater, []);
}

export async function updateNotices(updater: (items: Notice[]) => Notice[]) {
  return updateJsonFile<Notice[]>(NOTICES_FILE, updater, []);
}
