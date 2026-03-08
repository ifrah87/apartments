"use client";

import { Suspense, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import HeaderActions from "@/components/HeaderActions";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-app-surface">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />

      <div className="relative z-10 min-h-screen lg:flex">
        <header className="z-40 px-3 py-3 sm:px-4 lg:hidden">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-surface/70 text-slate-100 transition hover:border-white/20"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <Sidebar className="hidden lg:flex sticky top-0 h-screen overflow-y-auto" />

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true" role="dialog">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[18.5rem] max-w-[88vw] flex-col border-r border-white/10 bg-app-surface shadow-2xl">
              <div className="flex items-center justify-end px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-surface/70 text-slate-100"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Sidebar className="flex h-full w-full" onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="hidden items-center justify-end px-6 pt-4 lg:flex">
            <Suspense fallback={<div className="h-9 w-40" />}>
              <HeaderActions />
            </Suspense>
          </div>
          <main className="min-w-0 flex-1 overflow-x-auto px-3 pb-6 pt-4 sm:px-4 lg:px-6 lg:pt-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
