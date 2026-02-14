import "server-only";
import crypto from "crypto";
import type {
  GeneralSettings,
  BrandingSettings,
  BankSettings,
  BankAccount,
  PropertyTypesSettings,
  PropertyType,
  PaymentMethodsSettings,
  PaymentMethod,
  InitialReadingsSettings,
  ExpenseCategoriesSettings,
  ExpenseCategory,
  SettingsPayload,
} from "./types";
import {
  DEFAULT_GENERAL,
  DEFAULT_BRANDING,
  DEFAULT_BANK,
  DEFAULT_PROPERTY_TYPES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_INITIAL_READINGS,
  DEFAULT_EXPENSE_CATEGORIES,
} from "./defaults";

type NormalizeResult<T> = { value: T; errors: Record<string, string> };

const SETTINGS_META = {
  general: { key: "settings.general", defaults: DEFAULT_GENERAL },
  branding: { key: "settings.branding", defaults: DEFAULT_BRANDING },
  bank: { key: "settings.bank", defaults: DEFAULT_BANK },
  "property-types": { key: "settings.propertyTypes", defaults: DEFAULT_PROPERTY_TYPES },
  "payment-methods": { key: "settings.paymentMethods", defaults: DEFAULT_PAYMENT_METHODS },
  "initial-readings": { key: "settings.initialReadings", defaults: DEFAULT_INITIAL_READINGS },
  "expense-categories": { key: "settings.expenseCategories", defaults: DEFAULT_EXPENSE_CATEGORIES },
} as const;

export type SettingsKey = keyof typeof SETTINGS_META;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeGeneral(input: unknown, strict: boolean): NormalizeResult<GeneralSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const value: GeneralSettings = {
    orgName: asString(src.orgName, DEFAULT_GENERAL.orgName).trim(),
    displayName: asOptionalString(src.displayName).trim(),
    email: asString(src.email, DEFAULT_GENERAL.email).trim(),
    phone: asOptionalString(src.phone).trim(),
    address: asOptionalString(src.address).trim(),
    defaultCurrency: asString(src.defaultCurrency, DEFAULT_GENERAL.defaultCurrency).trim() || "USD",
    fiscalYearStartMonth: Math.min(12, Math.max(1, asNumber(src.fiscalYearStartMonth, DEFAULT_GENERAL.fiscalYearStartMonth))),
    timezone: asString(src.timezone, DEFAULT_GENERAL.timezone).trim() || "UTC",
  };

  if (strict) {
    if (!value.orgName) errors.orgName = "Organization name is required.";
    if (!value.email || !isValidEmail(value.email)) errors.email = "Valid primary email is required.";
  }

  return { value, errors };
}

function normalizeBranding(input: unknown, strict: boolean): NormalizeResult<BrandingSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const mode = asString(src.brandMode, DEFAULT_BRANDING.brandMode);
  const value: BrandingSettings = {
    appName: asString(src.appName, DEFAULT_BRANDING.appName).trim(),
    tagline: asString(src.tagline, DEFAULT_BRANDING.tagline).trim(),
    logoPath: asString(src.logoPath, DEFAULT_BRANDING.logoPath).trim(),
    brandMode: mode === "icon_only" ? "icon_only" : "icon_text",
  };

  if (strict && !value.appName) errors.appName = "App name is required.";

  return { value, errors };
}

function normalizeBank(input: unknown, strict: boolean): NormalizeResult<BankSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const accountsRaw = Array.isArray(src.accounts) ? src.accounts : [];
  const accounts: BankAccount[] = accountsRaw
    .filter((item) => isRecord(item))
    .map((item) => ({
      id: asString(item.id, "") || crypto.randomUUID(),
      nickname: asString(item.nickname, "").trim(),
      bankName: asOptionalString(item.bankName).trim(),
      holder: asOptionalString(item.holder).trim(),
      accountNumber: asOptionalString(item.accountNumber).trim(),
      iban: asOptionalString(item.iban).trim(),
      swift: asOptionalString(item.swift).trim(),
      currency: asString(item.currency, "USD").trim() || "USD",
      isDefault: asBool(item.isDefault, false),
    }));

  if (accounts.length) {
    let defaultIndex = accounts.findIndex((acct) => acct.isDefault);
    if (defaultIndex === -1) defaultIndex = 0;
    accounts.forEach((acct, index) => {
      acct.isDefault = index === defaultIndex;
      if (strict && !acct.nickname) {
        errors[`accounts.${acct.id}.nickname`] = "Account nickname is required.";
      }
    });
  }

  const value: BankSettings = {
    accounts,
    tenantInstructions: asString(src.tenantInstructions, DEFAULT_BANK.tenantInstructions),
  };

  return { value, errors };
}

function normalizePropertyTypes(input: unknown, strict: boolean): NormalizeResult<PropertyTypesSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const typesRaw = Array.isArray(src.types) ? src.types : [];
  const types: PropertyType[] = typesRaw
    .filter((item) => isRecord(item))
    .map((item) => ({
      id: asString(item.id, "") || crypto.randomUUID(),
      name: asString(item.name, "").trim(),
      code: asOptionalString(item.code).trim(),
      glCategory: asOptionalString(item.glCategory).trim(),
    }))
    .filter((item) => {
      if (strict && !item.name) {
        errors[`types.${item.id}.name`] = "Type name is required.";
        return true;
      }
      return item.name.length > 0;
    });

  return { value: { types }, errors };
}

function normalizePaymentMethods(input: unknown, strict: boolean): NormalizeResult<PaymentMethodsSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const methodsRaw = Array.isArray(src.methods) ? src.methods : [];
  const methods: PaymentMethod[] = methodsRaw
    .filter((item) => isRecord(item))
    .map((item) => ({
      id: asString(item.id, "") || crypto.randomUUID(),
      name: asString(item.name, "").trim(),
      enabled: asBool(item.enabled, true),
      requiresProof: asBool(item.requiresProof, false),
      autoMatchEligible: asBool(item.autoMatchEligible, false),
      notes: asOptionalString(item.notes).trim(),
    }))
    .filter((item) => {
      if (strict && !item.name) {
        errors[`methods.${item.id}.name`] = "Method name is required.";
        return true;
      }
      return item.name.length > 0;
    });

  return { value: { methods }, errors };
}

function normalizeInitialReadings(input: unknown, strict: boolean): NormalizeResult<InitialReadingsSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const enabledRaw = Array.isArray(src.enabledMeters) ? src.enabledMeters : DEFAULT_INITIAL_READINGS.enabledMeters;
  const enabledMeters = enabledRaw.filter((meter): meter is "electricity" | "water" => meter === "electricity" || meter === "water");
  const units = isRecord(src.units) ? src.units : {};
  const initialReadings = isRecord(src.initialReadings) ? src.initialReadings : {};
  const defaultReadingDay = asNumber(src.defaultReadingDay, DEFAULT_INITIAL_READINGS.defaultReadingDay || 1);
  const value: InitialReadingsSettings = {
    enabledMeters: enabledMeters.length ? enabledMeters : DEFAULT_INITIAL_READINGS.enabledMeters,
    units: {
      electricity: asString(units.electricity, DEFAULT_INITIAL_READINGS.units.electricity),
      water: asString(units.water, DEFAULT_INITIAL_READINGS.units.water),
    },
    initialReadings: {
      electricity: asNumber(initialReadings.electricity, DEFAULT_INITIAL_READINGS.initialReadings.electricity),
      water: asNumber(initialReadings.water, DEFAULT_INITIAL_READINGS.initialReadings.water),
    },
    requireProof: asBool(src.requireProof, DEFAULT_INITIAL_READINGS.requireProof),
    defaultReadingDay: Math.min(28, Math.max(1, defaultReadingDay)),
    rules: {
      allowZero: asBool(isRecord(src.rules) ? src.rules.allowZero : undefined, DEFAULT_INITIAL_READINGS.rules.allowZero),
      min: isRecord(src.rules) ? (Number.isFinite(Number(src.rules.min)) ? Number(src.rules.min) : undefined) : undefined,
      max: isRecord(src.rules) ? (Number.isFinite(Number(src.rules.max)) ? Number(src.rules.max) : undefined) : undefined,
    },
  };

  if (strict && !value.enabledMeters.length) {
    errors.enabledMeters = "Select at least one meter type.";
  }

  return { value, errors };
}

function normalizeExpenseCategories(input: unknown, strict: boolean): NormalizeResult<ExpenseCategoriesSettings> {
  const errors: Record<string, string> = {};
  const src = isRecord(input) ? input : {};
  const categoriesRaw = Array.isArray(src.categories) ? src.categories : [];
  const categories: ExpenseCategory[] = categoriesRaw
    .filter((item) => isRecord(item))
    .map((item) => {
      const rawType = asString(item.type, "expense");
      const type: ExpenseCategory["type"] =
        rawType === "cost_of_sales" || rawType === "overhead" ? rawType : "expense";
      const id = asString(item.id, "") || crypto.randomUUID();
      const code = asString(item.code, id).trim();
      return {
        id,
        code,
        name: asString(item.name, "").trim(),
        type,
        taxRate: asOptionalString(item.taxRate).trim(),
        description: asOptionalString(item.description).trim(),
        active: asBool(item.active, true),
        showOnPurchases: asBool(item.showOnPurchases, true),
      };
    })
    .filter((item) => {
      if (strict) {
        if (!item.name) errors[`categories.${item.id}.name`] = "Category name is required.";
        if (!item.code) errors[`categories.${item.id}.code`] = "Account code is required.";
      }
      return item.name.length > 0;
    });

  return { value: { categories }, errors };
}

export function getSettingsMeta(key: string) {
  if (key in SETTINGS_META) {
    return SETTINGS_META[key as SettingsKey];
  }
  return null;
}

export function normalizeSettings(key: SettingsKey, input: unknown, strict = false): NormalizeResult<SettingsPayload> {
  switch (key) {
    case "general":
      return normalizeGeneral(input, strict);
    case "branding":
      return normalizeBranding(input, strict);
    case "bank":
      return normalizeBank(input, strict);
    case "property-types":
      return normalizePropertyTypes(input, strict);
    case "payment-methods":
      return normalizePaymentMethods(input, strict);
    case "initial-readings":
      return normalizeInitialReadings(input, strict);
    case "expense-categories":
      return normalizeExpenseCategories(input, strict);
    default:
      return { value: input as SettingsPayload, errors: {} };
  }
}
