import type {
  GeneralSettings,
  BrandingSettings,
  BankSettings,
  PropertyTypesSettings,
  PaymentMethodsSettings,
  InitialReadingsSettings,
  ExpenseCategoriesSettings,
  LeaseTemplateSettings,
} from "./types";

export const DEFAULT_GENERAL: GeneralSettings = {
  orgName: "Orfane Tower",
  displayName: "Orfane Tower",
  email: "ops@orfane.com",
  phone: "",
  address: "",
  defaultCurrency: "USD",
  fiscalYearStartMonth: 1,
  timezone: "UTC",
};

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "Orfane Tower",
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
      holder: "Orfane Tower",
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

export const DEFAULT_LEASE_TEMPLATE: LeaseTemplateSettings = {
  mode: "html",
  htmlTemplate: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Lease Agreement</title>
    <style>
      body { font-family: "Inter", Arial, sans-serif; color: #0f172a; margin: 40px; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      h2 { font-size: 16px; margin-top: 24px; }
      .muted { color: #475569; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Lease Agreement</h1>
    <p class="muted">Date: {{today}}</p>
    <h2>Tenant Details</h2>
    <table>
      <tr><th>Property</th><td>{{property}}</td></tr>
      <tr><th>Tenant Name</th><td>{{tenantName}}</td></tr>
      <tr><th>Tenant Phone</th><td>{{tenantPhone}}</td></tr>
      <tr><th>Unit</th><td>{{unit}}</td></tr>
      <tr><th>Status</th><td>{{status}}</td></tr>
    </table>

    <h2>Lease Terms</h2>
    <table>
      <tr><th>Rent</th><td>{{rent}}</td></tr>
      <tr><th>Deposit</th><td>{{deposit}}</td></tr>
      <tr><th>Billing Cycle</th><td>{{cycle}}</td></tr>
      <tr><th>Start Date</th><td>{{startDate}}</td></tr>
      <tr><th>End Date</th><td>{{endDate}}</td></tr>
      <tr><th>Lease Duration</th><td>{{leaseDuration}}</td></tr>
    </table>

    <p class="muted">This template can be edited in Settings → Lease Template.</p>
  </body>
</html>`,
  pdfDataUrl: "",
  externalUrl: "",
};
