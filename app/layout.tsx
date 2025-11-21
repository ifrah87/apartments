import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Bell, CalendarDays, LifeBuoy } from "lucide-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f4f7fb] text-slate-900 antialiased">
        <div className="flex min-h-screen bg-[#f0f3fb]">
          <Sidebar />
          <div className="flex w-full flex-col">
            <header className="flex flex-wrap items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <HeaderIcon badge>
                  <Bell className="h-4 w-4" />
                </HeaderIcon>
                <div className="hidden flex-col text-xs text-slate-500 sm:flex">
                  <span className="font-semibold text-slate-700">Alerts & Notifications</span>
                  <span>No alerts · No notifications</span>
                </div>
              </div>
              <HeaderIcon>
                <LifeBuoy className="h-4 w-4" />
              </HeaderIcon>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm">
                <span className="font-semibold text-slate-800">IA</span>
                <span className="text-slate-500">Ifrah Awaale</span>
              </div>
            </header>
            <main className="flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

function HeaderIcon({ children, badge }: { children: React.ReactNode; badge?: boolean }) {
  return (
    <button className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900">
      {badge && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />}
      {children}
    </button>
  );
}
