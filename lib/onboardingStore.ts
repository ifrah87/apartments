import { readJsonFile, updateJsonFile } from "@/lib/storage/jsonStore";
import type { DocumentRecord, Lease, OnboardingCheckpoints, Tenant } from "@/lib/onboarding";

const TENANTS_FILE = "tenants.json";
const LEASES_FILE = "leases.json";
const ONBOARDING_FILE = "onboarding.json";
const DOCUMENTS_FILE = "documents.json";

export async function getTenants() {
  return readJsonFile<Tenant[]>(TENANTS_FILE, []);
}

export async function getLeases() {
  return readJsonFile<Lease[]>(LEASES_FILE, []);
}

export async function getCheckpoints() {
  return readJsonFile<OnboardingCheckpoints[]>(ONBOARDING_FILE, []);
}

export async function getDocuments() {
  return readJsonFile<DocumentRecord[]>(DOCUMENTS_FILE, []);
}

export async function updateTenants(updater: (items: Tenant[]) => Tenant[]) {
  return updateJsonFile<Tenant[]>(TENANTS_FILE, updater, []);
}

export async function updateLeases(updater: (items: Lease[]) => Lease[]) {
  return updateJsonFile<Lease[]>(LEASES_FILE, updater, []);
}

export async function updateCheckpoints(updater: (items: OnboardingCheckpoints[]) => OnboardingCheckpoints[]) {
  return updateJsonFile<OnboardingCheckpoints[]>(ONBOARDING_FILE, updater, []);
}

export async function updateDocuments(updater: (items: DocumentRecord[]) => DocumentRecord[]) {
  return updateJsonFile<DocumentRecord[]>(DOCUMENTS_FILE, updater, []);
}
