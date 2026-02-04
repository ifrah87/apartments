import { headers } from "next/headers";
import { getRequestBaseUrl } from "@/lib/utils/baseUrl";

type TicketRecord = {
  ticket_id: string;
  property_id: string;
  unit?: string;
  category?: string;
  priority?: string;
  status?: string;
  opened_at?: string;
  closed_at?: string;
  vendor?: string;
  cost?: string;
  description?: string;
};

type PropertyInfo = { property_id: string; name?: string };

export type MaintenanceFilters = {
  propertyId?: string;
  status?: string;
};

export type MaintenanceRow = {
  ticketId: string;
  propertyId: string;
  propertyName?: string;
  unit?: string;
  category?: string;
  priority: string;
  status: string;
  openedAt?: string;
  closedAt?: string;
  vendor?: string;
  cost: number;
  description?: string;
};

export type MaintenanceSummary = {
  open: number;
  inProgress: number;
  completed: number;
  highPriority: number;
  totalCost: number;
};

export type MaintenanceReportResult = {
  summary: MaintenanceSummary;
  rows: MaintenanceRow[];
};

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = getRequestBaseUrl(headers());
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const payload = await res.json();
  if (payload?.ok === false) throw new Error(payload.error || `Failed to fetch ${path}`);
  return (payload?.ok ? payload.data : payload) as T;
}

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function titleCase(value: string | undefined) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getPropertyName(id: string | undefined, properties: PropertyInfo[]) {
  if (!id) return undefined;
  const match = properties.find((p) => (p.property_id || "").toLowerCase() === id.toLowerCase());
  return match?.name || id;
}

export async function buildMaintenanceReport(filters: MaintenanceFilters, properties: PropertyInfo[]): Promise<MaintenanceReportResult> {
  const tickets = await fetchJson<TicketRecord[]>("/api/maintenance");
  const propertyFilter = (filters.propertyId || "").toLowerCase();
  const statusFilter = (filters.status || "").toLowerCase();

  const rows: MaintenanceRow[] = tickets
    .map((ticket) => {
      const propertyId = ticket.property_id || "";
      if (propertyFilter && propertyId.toLowerCase() !== propertyFilter) return null;
      const status = titleCase(ticket.status) || "Open";
      if (statusFilter && status.toLowerCase() !== statusFilter) return null;
      const priority = titleCase(ticket.priority) || "Medium";
      return {
        ticketId: ticket.ticket_id,
        propertyId,
        propertyName: getPropertyName(propertyId, properties),
        unit: ticket.unit,
        category: ticket.category,
        priority,
        status,
        openedAt: ticket.opened_at,
        closedAt: ticket.closed_at,
        vendor: ticket.vendor,
        cost: Number(toNumber(ticket.cost).toFixed(2)),
        description: ticket.description,
      };
    })
    .filter((row): row is MaintenanceRow => Boolean(row))
    .sort((a, b) => {
      if (a.status === b.status) {
        if (a.priority === b.priority) {
          return new Date(b.openedAt || "").getTime() - new Date(a.openedAt || "").getTime();
        }
        const priorityRank = (priority: string) => {
          if (priority.toLowerCase() === "high") return 0;
          if (priority.toLowerCase() === "medium") return 1;
          return 2;
        };
        return priorityRank(a.priority) - priorityRank(b.priority);
      }
      const order = ["Open", "In progress", "Completed"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const summary: MaintenanceSummary = rows.reduce(
    (acc, row) => {
      if (row.status === "Open") acc.open += 1;
      if (row.status === "In progress") acc.inProgress += 1;
      if (row.status === "Completed") acc.completed += 1;
      if (row.priority === "High") acc.highPriority += 1;
      acc.totalCost += row.cost;
      return acc;
    },
    { open: 0, inProgress: 0, completed: 0, highPriority: 0, totalCost: 0 },
  );
  summary.totalCost = Number(summary.totalCost.toFixed(2));

  return { summary, rows };
}
