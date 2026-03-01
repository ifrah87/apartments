import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HeaderActions from "@/components/HeaderActions";
import { Suspense } from "react";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { LanguageProvider } from "@/components/LanguageProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app-surface antialiased text-slate-100">
        <LanguageProvider>
          <ConfirmProvider>
            <div className="relative min-h-screen bg-app-surface">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
              <div className="relative z-10 flex min-h-screen pt-0">
                <Sidebar />
                <div className="relative flex w-full flex-col">
                  <div className="flex items-center justify-end px-6 pt-4">
                    <Suspense fallback={<div className="h-9 w-40" />}>
                      <HeaderActions />
                    </Suspense>
                  </div>
                  <main className="flex-1 px-6 pt-4 pb-6">{children}</main>
                </div>
              </div>
            </div>
          </ConfirmProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
