import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/app/LandingPage";

function getHost(headerValue: string | null) {
  return (headerValue || "localhost").split(":")[0];
}

const APP_HOSTS = new Set([
  "app.orfanerealestate.so",
]);

const MARKETING_HOSTS = new Set([
  "orfanerealestate.so",
  "www.orfanerealestate.so",
  "orfanerealestate.localhost",
]);

export default async function RootPage() {
  const headerStore = await headers();
  const host = getHost(
    headerStore.get("x-forwarded-host") ??
      headerStore.get("host"),
  );

  if (APP_HOSTS.has(host) || host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    redirect("/dashboard");
  }

  if (MARKETING_HOSTS.has(host)) {
    return <LandingPage />;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-slate-400">Landing page coming soon.</p>
    </div>
  );
}
