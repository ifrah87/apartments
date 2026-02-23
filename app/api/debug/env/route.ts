export async function GET() {
  const url = process.env.DATABASE_URL || "";
  const ca = process.env.DATABASE_SSL_CA || "";

  return Response.json({
    ok: true,
    hasDatabaseUrl: !!url,
    databaseUrlHost: url ? url.split("@")[1]?.split("/")[0] : null,
    hasDatabaseCa: !!ca,
    databaseCaLength: ca.length,
    databaseCaHasBegin: ca.includes("BEGIN CERTIFICATE"),
    databaseCaHasEnd: ca.includes("END CERTIFICATE"),
    databaseCaHasEscapedNewlines: ca.includes("\\n"),
    nodeVersion: process.version
  });
}
