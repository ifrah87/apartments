import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";

const DATASET_KEY = "services";

type ServiceRecord = {
  id: string;
  name: string;
  type: "metered" | "flat";
  unit: string;
  rate: number;
  accent?: "cyan" | "blue" | "emerald" | "violet" | "teal" | "amber";
  icon?: "water" | "electricity" | "money" | "security" | "generic";
};

const DEFAULT_SERVICES: ServiceRecord[] = [
  { id: "water", name: "Water Billing", type: "metered", unit: "m3", rate: 1.5, accent: "cyan", icon: "water" },
  {
    id: "electricity",
    name: "Electricity Billing",
    type: "metered",
    unit: "kWh",
    rate: 0.41,
    accent: "blue",
    icon: "electricity",
  },
  { id: "waste", name: "Waste Management", type: "flat", unit: "Month", rate: 7, accent: "amber", icon: "money" },
  {
    id: "cleaning",
    name: "Elevators + Cleaning",
    type: "flat",
    unit: "Month",
    rate: 13,
    accent: "amber",
    icon: "money",
  },
  { id: "security", name: "Security", type: "flat", unit: "Month", rate: 5, accent: "amber", icon: "money" },
];

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<ServiceRecord[]>(DATASET_KEY, DEFAULT_SERVICES);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ failed to load services", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<ServiceRecord>;
    if (!payload.name) {
      return NextResponse.json({ ok: false, error: "Service name is required." }, { status: 400 });
    }

    const entry: ServiceRecord = {
      id: payload.id ?? crypto.randomUUID(),
      name: payload.name,
      type: payload.type === "flat" ? "flat" : "metered",
      unit: payload.unit || "Unit",
      rate: toNumber(payload.rate),
      accent: payload.accent ?? (payload.type === "flat" ? "amber" : "cyan"),
      icon: payload.icon ?? (payload.type === "flat" ? "money" : "generic"),
    };

    const updated = await datasetsRepo.updateDataset<ServiceRecord[]>(
      DATASET_KEY,
      (current) => [...current, entry],
      DEFAULT_SERVICES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to create service", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<ServiceRecord>;
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Service id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<ServiceRecord[]>(
      DATASET_KEY,
      (current) => {
        let found = false;
        const next = current.map((item) => {
          if (item.id !== payload.id) return item;
          found = true;
          return {
            ...item,
            name: payload.name ?? item.name,
            type: payload.type === "flat" ? "flat" : payload.type === "metered" ? "metered" : item.type,
            unit: payload.unit ?? item.unit,
            rate: payload.rate !== undefined ? toNumber(payload.rate) : item.rate,
            accent: payload.accent ?? (payload.type === "flat" ? "amber" : payload.type === "metered" ? "cyan" : item.accent),
            icon: payload.icon ?? (payload.type === "flat" ? "money" : item.icon),
          } satisfies ServiceRecord;
        });
        if (!found) throw new Error("Service not found.");
        return next;
      },
      DEFAULT_SERVICES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to update service", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "Service id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<ServiceRecord[]>(
      DATASET_KEY,
      (current) => current.filter((item) => item.id !== payload.id),
      DEFAULT_SERVICES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to delete service", err);
    return handleError(err);
  }
}
