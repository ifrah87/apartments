import { redirect } from "next/navigation";

export default function OnboardingNewPage() {
  redirect("/admin/tenants/orgs");
}
