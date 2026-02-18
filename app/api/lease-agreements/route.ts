import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";
import { DEFAULT_LEASES, LeaseAgreement, LeaseAgreementStatus, LeaseBillingCycle } from "@/lib/leases";

const DATASET_KEY = "lease_agreements";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeList(value: unknown): LeaseAgreement[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as LeaseAgreement[];
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(status?: string): LeaseAgreementStatus {
  if (!status) return "Active";
  const normalized = status.toLowerCase();
  if (normalized.includes("term")) return "Terminated";
  if (normalized.includes("pending")) return "Pending";
  return "Active";
}

function normalizeCycle(cycle?: string): LeaseBillingCycle {
  if (!cycle) return "Monthly";
  const normalized = cycle.toLowerCase();
  if (normalized.includes("quarter")) return "Quarterly";
  if (normalized.includes("semi")) return "Semi-Annually";
  if (normalized.includes("annual")) return "Annually";
  return "Monthly";
}

export async function GET() {
  try {
    const data = await datasetsRepo.getDataset<LeaseAgreement[]>(DATASET_KEY, DEFAULT_LEASES);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("❌ failed to load lease agreements", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<LeaseAgreement>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ ok: false, error: "Invalid lease payload." }, { status: 400 });
    }
    if (!payload.unit || !payload.tenantName || !payload.startDate) {
      return NextResponse.json({ ok: false, error: "Unit, tenant name, and start date are required." }, { status: 400 });
    }

    const entry: LeaseAgreement = {
      id: payload.id ?? crypto.randomUUID(),
      property: payload.property ? String(payload.property) : "",
      unit: String(payload.unit),
      tenantName: String(payload.tenantName),
      tenantPhone: payload.tenantPhone ? String(payload.tenantPhone) : "",
      status: normalizeStatus(payload.status),
      cycle: normalizeCycle(payload.cycle),
      rent: toNumber(payload.rent),
      deposit: toNumber(payload.deposit),
      startDate: String(payload.startDate),
      endDate: payload.endDate ? String(payload.endDate) : "",
      leaseDuration: payload.leaseDuration ? String(payload.leaseDuration) : "Manual Date / Open",
    };

    const updated = await datasetsRepo.updateDataset<LeaseAgreement[]>(
      DATASET_KEY,
      (current) => [...normalizeList(current), entry],
      DEFAULT_LEASES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to create lease agreement", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<LeaseAgreement>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ ok: false, error: "Invalid lease payload." }, { status: 400 });
    }
    if (!payload.id) {
      return NextResponse.json({ ok: false, error: "Lease id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<LeaseAgreement[]>(
      DATASET_KEY,
      (current) => {
        const safeCurrent = normalizeList(current);
        let found = false;
        const next = safeCurrent.map((item) => {
          if (item.id !== payload.id) return item;
          found = true;
          return {
            ...item,
            property: payload.property !== undefined ? String(payload.property) : item.property,
            unit: payload.unit ? String(payload.unit) : item.unit,
            tenantName: payload.tenantName ? String(payload.tenantName) : item.tenantName,
            tenantPhone: payload.tenantPhone !== undefined ? String(payload.tenantPhone) : item.tenantPhone,
            status: payload.status ? normalizeStatus(payload.status) : item.status,
            cycle: payload.cycle ? normalizeCycle(payload.cycle) : item.cycle,
            rent: payload.rent !== undefined ? toNumber(payload.rent) : item.rent,
            deposit: payload.deposit !== undefined ? toNumber(payload.deposit) : item.deposit,
            startDate: payload.startDate ? String(payload.startDate) : item.startDate,
            endDate: payload.endDate !== undefined ? String(payload.endDate) : item.endDate,
            leaseDuration: payload.leaseDuration ? String(payload.leaseDuration) : item.leaseDuration,
          } satisfies LeaseAgreement;
        });
        if (!found) throw new Error("Lease not found.");
        return next;
      },
      DEFAULT_LEASES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to update lease agreement", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "Lease id is required." }, { status: 400 });
    }

    const updated = await datasetsRepo.updateDataset<LeaseAgreement[]>(
      DATASET_KEY,
      (current) => normalizeList(current).filter((item) => item.id !== payload.id),
      DEFAULT_LEASES,
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ failed to delete lease agreement", err);
    return handleError(err);
  }
}
