import type { TenantOrgStatus } from "@/lib/commercial";
import type { OnboardingStatus } from "@/lib/onboarding";
import { Badge } from "@/components/ui/Badge";

type Status = OnboardingStatus | TenantOrgStatus;

const STATUS_STYLES: Record<Status, { label: string; variant: "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Draft", variant: "info" },
  invited: { label: "Invited", variant: "info" },
  pending_payment: { label: "Pending payment", variant: "warning" },
  ready_to_move_in: { label: "Ready to move-in", variant: "info" },
  active: { label: "Active", variant: "success" },
  ended: { label: "Ended", variant: "danger" },
};

export default function StatusChip({ status }: { status: Status }) {
  const config = STATUS_STYLES[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
