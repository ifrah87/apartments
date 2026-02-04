import TenantOrgNav from "@/components/tenant-org/TenantOrgNav";

export default function TenantOrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tenant Portal</p>
            <h1 className="text-xl font-semibold text-slate-900">Commercial Workspace</h1>
          </div>
          <TenantOrgNav />
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
