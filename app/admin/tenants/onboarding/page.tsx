import { redirect } from "next/navigation";

export default function OnboardingListPage() {
  redirect("/admin/tenants/orgs");
}
