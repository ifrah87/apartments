export type LeaseAgreementStatus = "Active" | "Terminated" | "Pending";

export type LeaseBillingCycle = "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";

export type LeaseAgreement = {
  id: string;
  property?: string;
  unit: string;
  tenantName: string;
  tenantPhone?: string;
  status: LeaseAgreementStatus;
  cycle: LeaseBillingCycle;
  rent: number;
  deposit: number;
  startDate: string;
  endDate?: string;
  leaseDuration?: string;
};

export const DEFAULT_LEASES: LeaseAgreement[] = [
  {
    id: "lease-101-terminated",
    property: "Demo Tower",
    unit: "101",
    tenantName: "Ragsoor",
    tenantPhone: "+25261304675",
    status: "Terminated",
    cycle: "Monthly",
    rent: 500,
    deposit: 0,
    startDate: "2026-01-31",
    endDate: "2026-01-31",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-102",
    property: "Demo Tower",
    unit: "102",
    tenantName: "A1",
    tenantPhone: "+252613040675",
    status: "Active",
    cycle: "Semi-Annually",
    rent: 500,
    deposit: 1500,
    startDate: "2026-02-02",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-b1",
    property: "Demo Tower",
    unit: "B1",
    tenantName: "Abdirizak Xiin",
    tenantPhone: "+252618993248",
    status: "Active",
    cycle: "Monthly",
    rent: 1000,
    deposit: 1000,
    startDate: "2026-02-02",
    endDate: "2027-02-02",
    leaseDuration: "12 Months",
  },
  {
    id: "lease-c1",
    property: "Demo Tower",
    unit: "C1",
    tenantName: "Haji",
    tenantPhone: "88888",
    status: "Active",
    cycle: "Quarterly",
    rent: 500,
    deposit: 500,
    startDate: "2026-02-02",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-101-jama",
    property: "Demo Tower",
    unit: "101",
    tenantName: "Jama",
    tenantPhone: "+252613040675",
    status: "Active",
    cycle: "Monthly",
    rent: 200,
    deposit: 0,
    startDate: "2026-02-03",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-103",
    property: "Demo Tower",
    unit: "103",
    tenantName: "103",
    tenantPhone: "",
    status: "Active",
    cycle: "Monthly",
    rent: 100,
    deposit: 0,
    startDate: "2026-02-03",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-1003",
    property: "Demo Tower",
    unit: "1003",
    tenantName: "Mahamud",
    tenantPhone: "",
    status: "Active",
    cycle: "Monthly",
    rent: 370,
    deposit: 0,
    startDate: "2026-02-03",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
  {
    id: "lease-11012",
    property: "Demo Tower",
    unit: "11012",
    tenantName: "No Tenant",
    tenantPhone: "",
    status: "Active",
    cycle: "Monthly",
    rent: 100,
    deposit: 0,
    startDate: "2026-02-03",
    endDate: "",
    leaseDuration: "Manual Date / Open",
  },
];
