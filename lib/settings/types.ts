export type GeneralSettings = {
  orgName: string;
  displayName?: string;
  email: string;
  phone?: string;
  address?: string;
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  timezone: string;
};

export type BrandingSettings = {
  appName: string;
  tagline: string;
  logoPath: string;
  brandMode: "icon_only" | "icon_text";
};

export type BankAccount = {
  id: string;
  nickname: string;
  bankName?: string;
  holder?: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  currency?: string;
  isDefault: boolean;
};

export type BankSettings = {
  accounts: BankAccount[];
  tenantInstructions: string;
};

export type PropertyType = {
  id: string;
  name: string;
  code?: string;
  glCategory?: string;
};

export type PropertyTypesSettings = {
  types: PropertyType[];
};

export type PaymentMethod = {
  id: string;
  name: string;
  enabled: boolean;
  requiresProof: boolean;
  autoMatchEligible: boolean;
  notes?: string;
};

export type PaymentMethodsSettings = {
  methods: PaymentMethod[];
};

export type InitialReadingsSettings = {
  enabledMeters: Array<"electricity" | "water">;
  units: { electricity: string; water: string };
  initialReadings: { electricity: number; water: number };
  requireProof: boolean;
  defaultReadingDay?: number;
  rules: { allowZero: boolean; min?: number; max?: number };
};

export type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  type: "expense" | "cost_of_sales" | "overhead";
  taxRate?: string;
  description?: string;
  active: boolean;
  showOnPurchases: boolean;
};

export type ExpenseCategoriesSettings = {
  categories: ExpenseCategory[];
};

export type LeaseTemplateSettings = {
  mode: "html" | "pdf" | "url";
  htmlTemplate: string;
  pdfDataUrl: string;
  externalUrl: string;
};

export type SettingsPayload =
  | GeneralSettings
  | BrandingSettings
  | BankSettings
  | PropertyTypesSettings
  | PaymentMethodsSettings
  | InitialReadingsSettings
  | ExpenseCategoriesSettings
  | LeaseTemplateSettings;
