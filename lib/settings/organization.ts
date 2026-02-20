import "server-only";

import { datasetsRepo } from "@/lib/repos";
import { DEFAULT_BANK, DEFAULT_BRANDING, DEFAULT_GENERAL } from "@/lib/settings/defaults";
import { normalizeSettings } from "@/lib/settings/server";
import type { BankSettings, BrandingSettings, GeneralSettings } from "@/lib/settings/types";

export type OrganizationSnapshot = {
  general: GeneralSettings;
  branding: BrandingSettings;
  bank: BankSettings;
};

export type CompanyProfile = {
  name: string;
  address: string;
  email: string;
  phone: string;
  logoPath: string;
};

export async function getOrganizationSnapshot(): Promise<OrganizationSnapshot> {
  const [generalRaw, brandingRaw, bankRaw] = await Promise.all([
    datasetsRepo.getDataset("settings.general", DEFAULT_GENERAL),
    datasetsRepo.getDataset("settings.branding", DEFAULT_BRANDING),
    datasetsRepo.getDataset("settings.bank", DEFAULT_BANK),
  ]);

  const general = normalizeSettings("general", generalRaw, false).value as GeneralSettings;
  const branding = normalizeSettings("branding", brandingRaw, false).value as BrandingSettings;
  const bank = normalizeSettings("bank", bankRaw, false).value as BankSettings;

  return { general, branding, bank };
}

export function resolveCompanyName(general: GeneralSettings, branding: BrandingSettings) {
  return general.orgName?.trim() || branding.appName?.trim() || DEFAULT_GENERAL.orgName;
}

export function buildCompanyProfile(snapshot: OrganizationSnapshot): CompanyProfile {
  const { general, branding } = snapshot;
  return {
    name: resolveCompanyName(general, branding),
    address: (general.address || "").trim(),
    email: (general.email || "").trim(),
    phone: (general.phone || "").trim(),
    logoPath: (branding.logoPath || "").trim(),
  };
}
