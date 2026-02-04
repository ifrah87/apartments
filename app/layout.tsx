import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HeaderActions from "@/components/HeaderActions";
import { LanguageProvider } from "@/components/LanguageProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-100">
        <LanguageProvider>
          <div className="flex min-h-screen bg-transparent">
            <Sidebar />
            <div className="flex w-full flex-col">
              <header className="sticky top-0 z-30 flex items-center justify-end border-b border-white/10 bg-surface/60 px-6 py-4 backdrop-blur">
                <HeaderActions />
              </header>
              <main className="flex-1 px-8 py-8">{children}</main>
            </div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
