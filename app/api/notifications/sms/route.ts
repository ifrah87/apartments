import { NextResponse } from "next/server";
import { sendSms } from "@/lib/twilio";
import { normalizeId } from "@/lib/reports/tenantStatement";
import { COMPANY_NAME, COMPANY_PHONE } from "@/lib/constants/branding";
import { tenantsRepo, type TenantRecord } from "@/lib/repos";

type SmsRequest = {
  tenantId?: string;
  to?: string;
  body?: string;
  template?: "late_rent";
};

export const runtime = "nodejs";

function normalizePhone(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function buildLateRentMessage(tenant: TenantRecord) {
  const tenantName = tenant.name || "tenant";
  const phone = COMPANY_PHONE ? ` Call ${COMPANY_PHONE} if you need help.` : "";
  return `Hi ${tenantName}, this is a reminder from ${COMPANY_NAME} that your rent is past due. Please log in to the tenant portal to pay.${phone}`;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as SmsRequest;
    const { tenantId, to, body, template } = payload || {};

    let targetPhone = normalizePhone(to);
    let messageBody = body?.trim();

    if (tenantId) {
      const tenants = await tenantsRepo.listTenants();
      const tenant = tenants.find((row) => normalizeId(row.id) === normalizeId(tenantId));
      if (!tenant) {
        return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
      }
      if (!targetPhone) {
        const tenantWithPhone = tenant as TenantRecord & { phone?: string | null };
        targetPhone = normalizePhone(tenantWithPhone.phone ?? undefined);
      }
      if (!messageBody && template === "late_rent") {
        messageBody = buildLateRentMessage(tenant);
      }
    }

    if (!targetPhone) {
      return NextResponse.json({ ok: false, error: "Missing phone number." }, { status: 400 });
    }
    if (!messageBody) {
      return NextResponse.json({ ok: false, error: "Missing SMS message body." }, { status: 400 });
    }

    const result = await sendSms({ to: targetPhone, body: messageBody });
    return NextResponse.json({ ok: true, sid: result.sid });
  } catch (err: any) {
    console.error("❌ SMS send failed", err);
    return NextResponse.json({ ok: false, error: "Failed to send SMS." }, { status: 500 });
  }
}
