export type ColumnValueType = "string" | "number" | "currency" | "date" | "percent";

export type ColumnDefinition = {
  key: string;
  label: string;
  description?: string;
  valueType?: ColumnValueType;
};

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "gte"
  | "lte"
  | "gt"
  | "lt"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty";

export type FilterCondition = {
  column: string;
  operator: FilterOperator;
  value?: string | number;
};

export type QuickFilter = {
  id: string;
  label: string;
  description?: string;
  conditions: FilterCondition[];
};

export type MetricDefinition = {
  id: string;
  label: string;
  aggregate: "sum" | "avg" | "count" | "max" | "min";
  column?: string;
  filter?: FilterCondition[];
  format?: "currency" | "number" | "percent";
  decimals?: number;
};

export type CustomDatasetId = "tenants" | "units" | "maintenance" | "unitExpenses" | "ownerSummary";

export type CustomDatasetMetadata = {
  id: CustomDatasetId;
  label: string;
  description: string;
  sourcePath: string;
  tags: string[];
  columns: ColumnDefinition[];
  defaultVisible: string[];
  searchKeys: string[];
  quickFilters?: QuickFilter[];
  metrics?: MetricDefinition[];
  sampleInsights?: string[];
};

export type CustomBlueprint = {
  id: string;
  name: string;
  description: string;
  datasetId: CustomDatasetId;
  columns?: string[];
  quickFilterIds?: string[];
  sort?: { column: string; direction: "asc" | "desc" };
  searchTerm?: string;
};

export const CUSTOM_DATASETS: CustomDatasetMetadata[] = [
  {
    id: "tenants",
    label: "Tenant roster",
    description: "Household directory including rent schedules and due days.",
    sourcePath: "/api/tenants",
    tags: ["residents", "rent"],
    columns: [
      { key: "id", label: "Tenant ID", description: "Unique identifier from accounting system." },
      { key: "name", label: "Tenant name" },
      { key: "building", label: "Building" },
      { key: "property_id", label: "Property ID" },
      { key: "unit", label: "Unit" },
      { key: "monthly_rent", label: "Monthly rent", valueType: "currency" },
      { key: "due_day", label: "Due day", valueType: "number" },
      { key: "reference", label: "Reference" },
    ],
    defaultVisible: ["name", "building", "unit", "monthly_rent", "due_day"],
    searchKeys: ["name", "building", "property_id", "unit", "reference"],
    quickFilters: [
      {
        id: "high-rent",
        label: "$1.5k+ rent",
        description: "Tenancies with higher monthly rent.",
        conditions: [{ column: "monthly_rent", operator: "gte", value: 1500 }],
      },
      {
        id: "first-week",
        label: "Due day ≤ 5",
        description: "Collections due in the first week.",
        conditions: [{ column: "due_day", operator: "lte", value: 5 }],
      },
      {
        id: "taleex",
        label: "Taleex building",
        description: "Filter to the Taleex portfolio only.",
        conditions: [{ column: "building", operator: "equals", value: "Taleex" }],
      },
    ],
    metrics: [
      { id: "tenant-count", label: "Total tenants", aggregate: "count", format: "number" },
      { id: "avg-rent", label: "Avg monthly rent", aggregate: "avg", column: "monthly_rent", format: "currency" },
      {
        id: "high-rent-count",
        label: "$1.5k+ households",
        aggregate: "count",
        filter: [{ column: "monthly_rent", operator: "gte", value: 1500 }],
        format: "number",
      },
    ],
    sampleInsights: [
      "Segment tenants over $1.5k to target luxury upgrade campaigns.",
      "Group due days to stagger collections follow-ups.",
    ],
  },
  {
    id: "units",
    label: "Unit inventory",
    description: "Available units with configuration, rent and status.",
    sourcePath: "/api/unit-inventory",
    tags: ["vacancy", "leasing"],
    columns: [
      { key: "property_id", label: "Property ID" },
      { key: "unit", label: "Unit" },
      { key: "unit_type", label: "Unit type" },
      { key: "beds", label: "Beds", valueType: "number" },
      { key: "floor", label: "Floor", valueType: "number" },
      { key: "rent", label: "Asking rent", valueType: "currency" },
      { key: "status", label: "Status" },
    ],
    defaultVisible: ["property_id", "unit", "unit_type", "rent", "status"],
    searchKeys: ["property_id", "unit", "status", "unit_type"],
    quickFilters: [
      { id: "vacant", label: "Vacant units", conditions: [{ column: "status", operator: "equals", value: "Vacant" }] },
      {
        id: "family",
        label: "3+ beds",
        conditions: [{ column: "beds", operator: "gte", value: 3 }],
      },
      {
        id: "premium",
        label: "Rent ≥ $1.4k",
        conditions: [{ column: "rent", operator: "gte", value: 1400 }],
      },
    ],
    metrics: [
      { id: "unit-count", label: "Units", aggregate: "count", format: "number" },
      {
        id: "vacant-count",
        label: "Vacant",
        aggregate: "count",
        filter: [{ column: "status", operator: "equals", value: "Vacant" }],
        format: "number",
      },
      { id: "avg-rent", label: "Avg asking rent", aggregate: "avg", column: "rent", format: "currency" },
    ],
    sampleInsights: [
      "Which premium vacancies are ready for marketing?",
      "Cross-reference beds/floors to prep make-ready schedules.",
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance tickets",
    description: "Active requests with vendor assignments and costs.",
    sourcePath: "/api/maintenance",
    tags: ["operations", "repairs"],
    columns: [
      { key: "ticket_id", label: "Ticket ID" },
      { key: "property_id", label: "Property ID" },
      { key: "unit", label: "Unit" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "opened_at", label: "Opened", valueType: "date" },
      { key: "closed_at", label: "Closed", valueType: "date" },
      { key: "vendor", label: "Vendor" },
      { key: "cost", label: "Cost", valueType: "currency" },
      { key: "description", label: "Description" },
    ],
    defaultVisible: ["ticket_id", "property_id", "unit", "priority", "status", "cost"],
    searchKeys: ["ticket_id", "property_id", "unit", "category", "vendor", "description"],
    quickFilters: [
      {
        id: "open-tickets",
        label: "Open tickets",
        conditions: [{ column: "status", operator: "notEquals", value: "Completed" }],
      },
      {
        id: "high-priority",
        label: "High priority",
        conditions: [{ column: "priority", operator: "equals", value: "High" }],
      },
      {
        id: "with-vendor",
        label: "Vendor assigned",
        conditions: [{ column: "vendor", operator: "isNotEmpty" }],
      },
    ],
    metrics: [
      { id: "ticket-count", label: "Tickets", aggregate: "count", format: "number" },
      {
        id: "open-count",
        label: "Open tickets",
        aggregate: "count",
        filter: [{ column: "status", operator: "notEquals", value: "Completed" }],
        format: "number",
      },
      { id: "avg-cost", label: "Avg cost", aggregate: "avg", column: "cost", format: "currency" },
    ],
    sampleInsights: [
      "Highlight open high-priority requests awaiting vendor assignments.",
      "Track cost trends by property or issue type.",
    ],
  },
  {
    id: "unitExpenses",
    label: "Unit expenses",
    description: "Turnover and maintenance spend attributed to each unit.",
    sourcePath: "/api/unit-expenses",
    tags: ["expenses", "turnover"],
    columns: [
      { key: "property_id", label: "Property ID" },
      { key: "unit", label: "Unit" },
      { key: "date", label: "Date", valueType: "date" },
      { key: "amount", label: "Amount", valueType: "currency" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
    ],
    defaultVisible: ["property_id", "unit", "date", "category", "amount"],
    searchKeys: ["property_id", "unit", "category", "description"],
    quickFilters: [
      { id: "major", label: ">$250", conditions: [{ column: "amount", operator: "gt", value: 250 }] },
      {
        id: "plumbing",
        label: "Plumbing",
        conditions: [{ column: "category", operator: "equals", value: "Plumbing" }],
      },
      {
        id: "recent",
        label: "2024 H2",
        conditions: [{ column: "date", operator: "gte", value: "2024-07-01" }],
      },
    ],
    metrics: [
      { id: "expense-count", label: "Entries", aggregate: "count", format: "number" },
      { id: "total-spend", label: "Total spend", aggregate: "sum", column: "amount", format: "currency" },
      { id: "avg-spend", label: "Avg cost", aggregate: "avg", column: "amount", format: "currency" },
    ],
    sampleInsights: [
      "Compare turnover cost per unit.",
      "Surface high-cost vendors or categories fast.",
    ],
  },
  {
    id: "ownerSummary",
    label: "Owner summary",
    description: "Monthly performance by property, including occupancy and arrears.",
    sourcePath: "/api/monthly-owner-summary",
    tags: ["owners", "performance"],
    columns: [
      { key: "property_id", label: "Property ID" },
      { key: "month", label: "Month" },
      { key: "rent_collected", label: "Rent collected", valueType: "currency" },
      { key: "operating_expenses", label: "Operating expenses", valueType: "currency" },
      { key: "net_income", label: "Net income", valueType: "currency" },
      { key: "occupancy_rate", label: "Occupancy %", valueType: "percent" },
      { key: "arrears_total", label: "Arrears", valueType: "currency" },
    ],
    defaultVisible: ["property_id", "month", "rent_collected", "net_income", "occupancy_rate"],
    searchKeys: ["property_id", "month"],
    quickFilters: [
      {
        id: "low-occupancy",
        label: "Occupancy < 90%",
        conditions: [{ column: "occupancy_rate", operator: "lt", value: 90 }],
      },
      {
        id: "high-arrears",
        label: "Arrears > $3k",
        conditions: [{ column: "arrears_total", operator: "gt", value: 3000 }],
      },
      {
        id: "net-income-flag",
        label: "Net income < $20k",
        conditions: [{ column: "net_income", operator: "lt", value: 20000 }],
      },
    ],
    metrics: [
      { id: "owner-count", label: "Properties", aggregate: "count", format: "number" },
      { id: "total-net", label: "Total net income", aggregate: "sum", column: "net_income", format: "currency" },
      {
        id: "avg-occupancy",
        label: "Avg occupancy",
        aggregate: "avg",
        column: "occupancy_rate",
        format: "percent",
        decimals: 1,
      },
    ],
    sampleInsights: [
      "Identify owners with slipping occupancy or high arrears.",
      "Rank profitability to guide distributions.",
    ],
  },
];

export const CUSTOM_BLUEPRINTS: CustomBlueprint[] = [
  {
    id: "vacancy-pipeline",
    name: "Vacancy pipeline",
    description: "Vacant units sorted by rent to prioritize marketing.",
    datasetId: "units",
    columns: ["property_id", "unit", "unit_type", "floor", "rent", "status"],
    quickFilterIds: ["vacant"],
    sort: { column: "rent", direction: "desc" },
  },
  {
    id: "high-rent-households",
    name: "High-rent households",
    description: "Tenants paying $1.5k+ with due-day context.",
    datasetId: "tenants",
    columns: ["name", "building", "unit", "monthly_rent", "due_day"],
    quickFilterIds: ["high-rent"],
    sort: { column: "monthly_rent", direction: "desc" },
  },
  {
    id: "priority-maintenance",
    name: "Priority maintenance queue",
    description: "Open high-priority tickets awaiting closure.",
    datasetId: "maintenance",
    columns: ["ticket_id", "property_id", "unit", "category", "priority", "status", "vendor", "cost"],
    quickFilterIds: ["open-tickets", "high-priority"],
    sort: { column: "cost", direction: "desc" },
  },
  {
    id: "owner-watchlist",
    name: "Owner watchlist",
    description: "Owners with low occupancy or high arrears.",
    datasetId: "ownerSummary",
    columns: ["property_id", "month", "net_income", "occupancy_rate", "arrears_total"],
    quickFilterIds: ["low-occupancy", "high-arrears"],
    sort: { column: "occupancy_rate", direction: "asc" },
  },
];
