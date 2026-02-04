import "server-only";

export function getRequestBaseUrl(requestHeaders: Headers): string {
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    throw new Error("Missing host header. Cannot determine request base URL.");
  }

  return `${proto}://${host}`;
}
