import { NextRequest, NextResponse } from "next/server";
import { datasetsRepo, RepoError } from "@/lib/repos";

const DATASET_KEY = "building_services";

type BuildingServiceRecord = {
  id: string;
  propertyId: string;
  serviceId: string;
  startDate: string;
  createdAt: string;
};

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeList(value: unknown): BuildingServiceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as BuildingServiceRecord[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const data = await datasetsRepo.getDataset<BuildingServiceRecord[]>(DATASET_KEY, []);
    const list = normalizeList(data);
    const filtered = propertyId ? list.filter((item) => item.propertyId === propertyId) : list;
    return NextResponse.json({ ok: true, data: filtered });
  } catch (err) {
    console.error("❌ /api/building-services failed:", err);
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<BuildingServiceRecord>;
    if (!payload?.propertyId || !payload?.serviceId || !payload?.startDate) {
      return NextResponse.json(
        { ok: false, error: "propertyId, serviceId, and startDate are required." },
        { status: 400 },
      );
    }
    const entry: BuildingServiceRecord = {
      id: payload.id ?? crypto.randomUUID(),
      propertyId: String(payload.propertyId),
      serviceId: String(payload.serviceId),
      startDate: String(payload.startDate),
      createdAt: new Date().toISOString(),
    };
    const updated = await datasetsRepo.updateDataset<BuildingServiceRecord[]>(
      DATASET_KEY,
      (current) => [...normalizeList(current), entry],
      [],
    );
    return NextResponse.json({ ok: true, data: updated }, { status: 201 });
  } catch (err) {
    console.error("❌ /api/building-services POST failed:", err);
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<BuildingServiceRecord>;
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    const updated = await datasetsRepo.updateDataset<BuildingServiceRecord[]>(
      DATASET_KEY,
      (current) =>
        normalizeList(current).map((item) =>
          item.id === payload.id
            ? {
                ...item,
                startDate: payload.startDate ? String(payload.startDate) : item.startDate,
                serviceId: payload.serviceId ? String(payload.serviceId) : item.serviceId,
              }
            : item,
        ),
      [],
    );
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ /api/building-services PUT failed:", err);
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as { id?: string };
    if (!payload?.id) {
      return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
    }
    const updated = await datasetsRepo.updateDataset<BuildingServiceRecord[]>(
      DATASET_KEY,
      (current) => normalizeList(current).filter((item) => item.id !== payload.id),
      [],
    );
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ /api/building-services DELETE failed:", err);
    return handleError(err);
  }
}
