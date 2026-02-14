import type {
  GeneralSettings,
  BrandingSettings,
  BankSettings,
  PropertyTypesSettings,
  PaymentMethodsSettings,
  InitialReadingsSettings,
  ExpenseCategoriesSettings,
} from "./types";

export const DEFAULT_GENERAL: GeneralSettings = {
  orgName: "Orfane Real Estate",
  displayName: "Orfane",
  email: "ops@orfane.com",
  phone: "",
  address: "",
  defaultCurrency: "USD",
  fiscalYearStartMonth: 1,
  timezone: "UTC",
};

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "Orfane Real Estate",
  tagline: "Property operations & finance",
  logoPath: "/logos/orfane-logo-crop.png",
  brandMode: "icon_text",
};

export const DEFAULT_BANK: BankSettings = {
  accounts: [
    {
      id: "acct_default",
      nickname: "Business Bank Account",
      bankName: "",
      holder: "Orfane Real Estate",
      accountNumber: "",
      iban: "",
      swift: "",
      currency: "USD",
      isDefault: true,
    },
  ],
  tenantInstructions: "Please use your Unit + Name as the payment reference.",
};

export const DEFAULT_PROPERTY_TYPES: PropertyTypesSettings = {
  types: [
    { id: "type_res", name: "Residence", code: "RES" },
    { id: "type_off", name: "Office", code: "OFF" },
    { id: "type_com", name: "Commercial", code: "COM" },
  ],
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodsSettings = {
  methods: [
    { id: "pm_bank", name: "Bank Transfer", enabled: true, requiresProof: false, autoMatchEligible: true, notes: "" },
    { id: "pm_cash", name: "Cash", enabled: true, requiresProof: true, autoMatchEligible: false, notes: "" },
    { id: "pm_mobile", name: "Mobile Money", enabled: true, requiresProof: true, autoMatchEligible: false, notes: "" },
  ],
};

export const DEFAULT_INITIAL_READINGS: InitialReadingsSettings = {
  enabledMeters: ["electricity", "water"],
  units: { electricity: "kWh", water: "m3" },
  initialReadings: { electricity: 0, water: 0 },
  requireProof: true,
  defaultReadingDay: 1,
  rules: { allowZero: true },
};

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoriesSettings = {
  categories: [
    {
      id: "exp_5000",
      code: "5000",
      name: "Maintenance & Repairs",
      type: "expense",
      taxRate: "No Tax",
      description: "",
      active: true,
      showOnPurchases: true,
    },
    {
      id: "exp_5050",
      code: "5050",
      name: "Cleaning & Housekeeping",
      type: "expense",
      taxRate: "No Tax",
      description: "",
      active: true,
      showOnPurchases: true,
    },
    {
      id: "exp_5100",
      code: "5100",
      name: "Utilities",
      type: "expense",
      taxRate: "No Tax",
      description: "",
      active: true,
      showOnPurchases: true,
    },
    {
      id: "exp_5200",
      code: "5200",
      name: "Insurance",
      type: "expense",
      taxRate: "No Tax",
      description: "",
      active: true,
      showOnPurchases: true,
    },
    {
      id: "exp_5999",
      code: "5999",
      name: "Miscellaneous Expense",
      type: "expense",
      taxRate: "No Tax",
      description: "",
      active: true,
      showOnPurchases: true,
    },
  ],
};
