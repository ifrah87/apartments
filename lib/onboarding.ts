import crypto from "crypto";

export type OnboardingStatus =
  | "draft"
  | "invited"
  | "pending_payment"
  | "ready_to_move_in"
  | "active"
  | "ended";

export type Tenant = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  unitId: string;
  propertyId: string;
  leaseId: string;
  role: "tenant";
  onboardingStatus: OnboardingStatus;
  createdAt: string;
  updatedAt: string;
};

export type Lease = {
  id: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  dueDay: number;
  graceDays: number;
  currency: string;
};

export type OnboardingCheckpoints = {
  tenantId: string;
  leaseUploaded: boolean;
  leaseAcknowledged: boolean;
  depositExpected: number;
  depositReceived: boolean;
  firstRentExpected: number;
  firstRentReceived: boolean;
  portalInviteSent: boolean;
  tenantFirstLogin: boolean;
  contactConfirmed: boolean;
  moveInConditionConfirmed: boolean;
  activationToken?: string;
  activationExpiresAt?: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  tenantId: string;
  type: "lease" | "house_rules" | "welcome_pack" | "deposit_receipt" | "statement";
  name: string;
  url: string;
  uploadedAt: string;
};

export const REQUIRED_FOR_ACTIVE: (keyof OnboardingCheckpoints)[] = [
  "leaseUploaded",
  "depositReceived",
  "firstRentReceived",
  "leaseAcknowledged",
  "contactConfirmed",
];

export function computeMissing(checkpoints: OnboardingCheckpoints) {
  const missing: string[] = [];
  if (!checkpoints.leaseUploaded) missing.push("Lease");
  if (!checkpoints.depositReceived) missing.push("Deposit");
  if (!checkpoints.firstRentReceived) missing.push("First rent");
  if (!checkpoints.portalInviteSent) missing.push("Invite");
  if (!checkpoints.leaseAcknowledged) missing.push("Lease ack");
  if (!checkpoints.contactConfirmed) missing.push("Contact");
  if (!checkpoints.moveInConditionConfirmed) missing.push("Move-in");
  return missing;
}

export function canActivate(checkpoints: OnboardingCheckpoints) {
  return REQUIRED_FOR_ACTIVE.every((key) => Boolean(checkpoints[key]));
}

export function computeStatus(current: OnboardingStatus, checkpoints: OnboardingCheckpoints): OnboardingStatus {
  if (current === "ended") return current;
  if (canActivate(checkpoints)) return "active";
  if (checkpoints.portalInviteSent) return "invited";
  if (checkpoints.leaseUploaded && checkpoints.depositReceived && checkpoints.firstRentReceived) {
    return "ready_to_move_in";
  }
  if (checkpoints.leaseUploaded) return "pending_payment";
  return "draft";
}

export function createActivationToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
