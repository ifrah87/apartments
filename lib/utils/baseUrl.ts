import "server-only";
import { headers } from "next/headers";

export async function getRequestBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) {
    throw new Error("Missing host header. Cannot determine request base URL.");
  }

  return `${proto}://${host}`;
}
