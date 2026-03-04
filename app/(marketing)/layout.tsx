import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Orfane Real Estate",
  description: "Premium property management in Mogadishu.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Public nav */}
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Orfane Real Estate
          </span>
          <a
            href="https://app.orfanerealestate.so"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Tenant portal
          </a>
        </div>
      </header>

      {/* Page content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Orfane Real Estate · Mogadishu, Somalia
      </footer>
    </div>
  );
}
