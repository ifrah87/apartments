export function assertAdminDelete(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-admin-delete-key") || "";

  const expected = process.env.ADMIN_DELETE_KEY || "";
  if (!expected || key !== expected) {
    return { ok: false as const, res: Response.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}
