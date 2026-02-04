import { cookies } from "next/headers";

export function getTenantOrgSessionId() {
  return cookies().get("tenant_org_session")?.value;
}
