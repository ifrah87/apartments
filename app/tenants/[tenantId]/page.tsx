import { redirect } from "next/navigation";

type SearchParams = {
  tab?: string;
};

export default async function TenantRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const tab = sp.tab || "statement";
  redirect(`/tenants?tenantId=${tenantId}&tab=${tab}`);
}
