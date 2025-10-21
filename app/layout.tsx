import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";   // <-- new light rail

export const metadata: Metadata = {
  title: "Taleex Apartments",
  description: "Property management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-64 flex-1 px-6 py-6 mx-auto w-full max-w-[1200px]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

