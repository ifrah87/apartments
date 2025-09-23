import "./globals.css";
import SidebarLS from "../components/SidebarLS";


export const metadata = { title: "Taleex Apartments", description: "Dashboard" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50">
        <SidebarLS />
        <main className="min-h-screen md:pl-80">
          <div className="p-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
