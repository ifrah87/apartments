import { redirect } from "next/navigation";

export default function OnboardingWizardPage({ params }: { params: { tenantId: string } }) {
  redirect(`/tenants/onboarding/${params.tenantId}`);
}
