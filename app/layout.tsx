import "./globals.css";
import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "",
  description: "Rental management SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex">
          <aside className="shrink-0 w-40 bg-[#0E1325] text-white flex flex-col items-center py-8">
  {/* Logo + brand */}
  <div className="flex flex-col items-center space-y-3">
    <img
      src="/taleex-logo.png"
      alt="Taleex Apartments logo"
      className="w-200 h-auto object-contain"   // 👈 bigger logo
    />
    <span className="text-base font-semibold tracking-wide text-center">
      
    </span>
  </div>

             {/* Nav */}
  <nav className="mt-6 space-y-1 text-sm">
    <Link href="/dashboard"   className="block rounded-lg px-3 py-2 hover:bg-white/5">Dashboard</Link>
    <Link href="/properties"  className="block rounded-lg px-3 py-2 hover:bg-white/5">Properties</Link>
    <Link href="/tenants"     className="block rounded-lg px-3 py-2 hover:bg-white/5">Tenants</Link>
    <Link href="/reports/pnl" className="block rounded-lg px-3 py-2 hover:bg-white/5">Reports</Link>
    <Link href="/maintenance" className="block rounded-lg px-3 py-2 hover:bg-white/5">Maintenance</Link>
    <Link href="/settings"    className="block rounded-lg px-3 py-2 hover:bg-white/5">Settings</Link>
  </nav>
</aside>
          <main className="flex-1 p-6 space-y-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

