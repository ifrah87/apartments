export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL;
    return url.startsWith("http") ? url : `https://${url}`;
  }
  if (process.env.NEXT_BASE_URL) {
    return process.env.NEXT_BASE_URL;
  }
  return "http://localhost:3000";
}

export function buildApiUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
