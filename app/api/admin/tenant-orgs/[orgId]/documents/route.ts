import { NextResponse } from "next/server";
import crypto from "crypto";
import { computeCommercialStatus, nowIso, type CommercialDocument } from "@/lib/commercial";
import {
  getCommercialCheckpoints,
  getCommercialDocuments,
  getTenantOrgs,
  updateCommercialCheckpoints,
  updateCommercialDocuments,
  updateTenantOrgs,
} from "@/lib/commercialStore";

export const runtime = "nodejs";

type Payload = {
  name: string;
  url: string;
  type: CommercialDocument["type"];
  markLeaseUploaded?: boolean;
};

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  const { orgId } = await Promise.resolve(params);
  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.url) {
      return NextResponse.json({ ok: false, error: "Missing document URL." }, { status: 400 });
    }

    const [orgs, checkpoints, documents] = await Promise.all([
      getTenantOrgs(),
      getCommercialCheckpoints(),
      getCommercialDocuments(),
    ]);
    const org = orgs.find((item) => item.id === orgId);
    if (!org) {
      return NextResponse.json({ ok: false, error: "Tenant org not found." }, { status: 404 });
    }
    const checkpoint = checkpoints.find((item) => item.tenantOrgId === orgId);
    if (!checkpoint) {
      return NextResponse.json({ ok: false, error: "Onboarding record not found." }, { status: 404 });
    }

    const doc: CommercialDocument = {
      id: crypto.randomUUID(),
      tenantOrgId: orgId,
      type: payload.type,
      name: payload.name || payload.type,
      url: payload.url,
      uploadedAt: nowIso(),
    };

    await updateCommercialDocuments((items) => [...items, doc]);

    let updatedCheckpoint = checkpoint;
    if (payload.markLeaseUploaded) {
      await updateCommercialCheckpoints((items) =>
        items.map((item) => {
          if (item.tenantOrgId !== orgId) return item;
          updatedCheckpoint = { ...item, leaseUploaded: true, updatedAt: nowIso() };
          return updatedCheckpoint;
        }),
      );

      await updateTenantOrgs((items) =>
        items.map((item) => {
          if (item.id !== orgId) return item;
          const nextStatus = computeCommercialStatus(item.status, updatedCheckpoint);
          return { ...item, status: nextStatus, updatedAt: nowIso() };
        }),
      );
    }

    return NextResponse.json({ ok: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to upload document." }, { status: 500 });
  }
}
