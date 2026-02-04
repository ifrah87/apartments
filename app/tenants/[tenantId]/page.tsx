import { redirect } from "next/navigation";

type SearchParams = {
  tab?: string;
};

export default function TenantRedirectPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: SearchParams;
}) {
  const tab = searchParams.tab || "statement";
  redirect(`/tenants?tenantId=${params.tenantId}&tab=${tab}`);
}
