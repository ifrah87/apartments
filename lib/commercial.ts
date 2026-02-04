import crypto from "crypto";

export type TenantOrgStatus = "draft" | "invited" | "active" | "ended";

export type TenantOrg = {
  id: string;
  name: string;
  billingEmail: string;
  billingPhone?: string;
  financeContactName?: string;
  facilitiesContactName?: string;
  facilitiesContactEmail?: string;
  unitIds: string[];
  propertyId: string;
  status: TenantOrgStatus;
  createdAt: string;
  updatedAt: string;
};

export type LeaseCommercial = {
  id: string;
  tenantOrgId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  serviceChargeAmount?: number;
  dueDay: number;
  graceDays: number;
  currency: string;
};

export type OnboardingCheckpointsCommercial = {
  tenantOrgId: string;
  leaseUploaded: boolean;
  invoicesEnabled: boolean;
  depositOrGuaranteeConfirmed: boolean;
  houseRulesConfirmed?: boolean;
  idCopyTaken?: boolean;
  accessCardsIssued?: boolean;
  portalInviteSent: boolean;
  firstLogin: boolean;
  contactsConfirmed: boolean;
  updatedAt: string;
  activationToken?: string;
  tokenExpiresAt?: string;
};

export type Invoice = {
  id: string;
  tenantOrgId: string;
  type: "rent" | "service_charge" | "other";
  period: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "open" | "paid" | "overdue";
  pdfUrl?: string;
  createdAt: string;
};

export type CommercialDocument = {
  id: string;
  tenantOrgId: string;
  type: "lease" | "house_rules" | "compliance" | "welcome_pack" | "statement";
  name: string;
  url: string;
  uploadedAt: string;
};

export type FacilitiesTicket = {
  id: string;
  tenantOrgId: string;
  unitId?: string;
  category: "HVAC" | "Electrical" | "Plumbing" | "Access" | "Other";
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
};

export type Notice = {
  id: string;
  propertyId: string;
  title: string;
  body: string;
  createdAt: string;
  visibility: "all_tenants" | "tenantOrgIds";
  tenantOrgIds?: string[];
};

export const COMMERCIAL_REQUIRED_FOR_ACTIVE: (keyof OnboardingCheckpointsCommercial)[] = [
  "leaseUploaded",
  "houseRulesConfirmed",
  "idCopyTaken",
  "accessCardsIssued",
  "depositOrGuaranteeConfirmed",
];

export function computeCommercialStatus(
  current: TenantOrgStatus,
  checkpoints: OnboardingCheckpointsCommercial,
): TenantOrgStatus {
  if (current === "ended") return current;
  if (COMMERCIAL_REQUIRED_FOR_ACTIVE.every((key) => Boolean(checkpoints[key]))) return "active";
  if (checkpoints.portalInviteSent) return "invited";
  return "draft";
}

export function computeCommercialMissing(checkpoints: OnboardingCheckpointsCommercial) {
  const missing: string[] = [];
  if (!checkpoints.leaseUploaded) missing.push("Lease");
  if (!checkpoints.houseRulesConfirmed) missing.push("House rules");
  if (!checkpoints.idCopyTaken) missing.push("ID copy");
  if (!checkpoints.accessCardsIssued) missing.push("Keys");
  if (!checkpoints.depositOrGuaranteeConfirmed) missing.push("Deposit + rent");
  return missing;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function createActivationToken() {
  return crypto.randomBytes(16).toString("hex");
}
