import { NextResponse } from "next/server";
import { sendSms } from "@/lib/twilio";

type SmsRequest = {
  to: string;
  body: string;
  tenantId?: string;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as SmsRequest;
    const to = typeof payload?.to === "string" ? payload.to.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";

    if (!to.startsWith("+")) {
      return NextResponse.json({ ok: false, error: "Phone number must be in E.164 format." }, { status: 400 });
    }
    if (!body) {
      return NextResponse.json({ ok: false, error: "Message body is required." }, { status: 400 });
    }
    if (body.length > 500) {
      return NextResponse.json({ ok: false, error: "Message body must be 500 characters or less." }, { status: 400 });
    }

    const result = await sendSms({ to, body });
    return NextResponse.json({ ok: true, sid: result.sid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send SMS.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
