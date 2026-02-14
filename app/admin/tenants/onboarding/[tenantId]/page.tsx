import { redirect } from "next/navigation";

export default async function OnboardingWizardPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  redirect(`/tenants/onboarding/${tenantId}`);
}
