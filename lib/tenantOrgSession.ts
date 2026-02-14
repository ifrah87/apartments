import { cookies } from "next/headers";

export async function getTenantOrgSessionId() {
  return (await cookies()).get("tenant_org_session")?.value;
}
