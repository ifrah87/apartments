import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile } from "@/lib/storage/jsonStore";

export const runtime = "nodejs";

type SopDoc = {
  content: string;
  updatedAt: string;
};

const SOP_FILE = "sop.json";

export async function GET() {
  const doc = await readJsonFile<SopDoc>(SOP_FILE, { content: "", updatedAt: "" });
  return NextResponse.json({ ok: true, doc });
}

export async function PATCH(req: Request) {
  try {
    const payload = (await req.json()) as { content?: string };
    const next = await updateJsonFile<SopDoc>(
      SOP_FILE,
      (current) => ({
        content: payload.content ?? current.content,
        updatedAt: new Date().toISOString(),
      }),
      { content: "", updatedAt: "" },
    );
    return NextResponse.json({ ok: true, doc: next });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update SOP." }, { status: 500 });
  }
}
