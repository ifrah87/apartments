import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <header className="border-b border-slate-100 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <span className="text-lg font-bold tracking-tight text-slate-900">Orfane Real Estate</span>
            <a
              href="https://app.orfanerealestate.so"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Tenant portal
            </a>
          </div>
        </header>

        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="text-slate-400">Landing page coming soon.</p>
        </main>

        <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} Orfane Real Estate · Mogadishu, Somalia
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-slate-400">Landing page coming soon.</p>
    </div>
  );
}
