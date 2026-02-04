import { cookies } from "next/headers";

export async function serverFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const cookieHeader = cookies().toString();
  const headers = new Headers(init.headers || {});
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return fetch(input, { ...init, headers });
}
