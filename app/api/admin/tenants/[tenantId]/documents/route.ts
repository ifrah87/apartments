import { NextResponse } from "next/server";
import crypto from "crypto";
import { computeStatus, nowIso, type DocumentRecord } from "@/lib/onboarding";
import { getCheckpoints, getTenants, updateCheckpoints, updateDocuments, updateTenants } from "@/lib/onboardingStore";

export const runtime = "nodejs";

type Payload = {
  type: DocumentRecord["type"];
  name: string;
  url: string;
  markLeaseUploaded?: boolean;
};

export async function POST(req: Request, { params }: { params: { tenantId: string } }) {
  try {
    const { tenantId } = await Promise.resolve(params);
    const payload = (await req.json()) as Payload;
    const tenants = await getTenants();
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) {
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
    }

    const document: DocumentRecord = {
      id: crypto.randomUUID(),
      tenantId,
      type: payload.type,
      name: payload.name,
      url: payload.url,
      uploadedAt: nowIso(),
    };

    await updateDocuments((items) => [...items, document]);

    let updatedCheckpoint = null;
    if (payload.markLeaseUploaded) {
      await updateCheckpoints((items) =>
        items.map((item) => {
          if (item.tenantId !== tenantId) return item;
          updatedCheckpoint = { ...item, leaseUploaded: true, updatedAt: nowIso() };
          return updatedCheckpoint;
        }),
      );
    }

    if (updatedCheckpoint) {
      await updateTenants((items) =>
        items.map((item) => {
          if (item.id !== tenantId) return item;
          const nextStatus = computeStatus(item.onboardingStatus, updatedCheckpoint!);
          return { ...item, onboardingStatus: nextStatus, updatedAt: nowIso() };
        }),
      );
    }

    return NextResponse.json({ ok: true, document });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to add document." }, { status: 500 });
  }
}
