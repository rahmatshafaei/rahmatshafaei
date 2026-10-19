import { BadgeCheck, CircleAlert, Users, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VERIFICATION_LABELS } from "@/lib/labels";

type Verification = keyof typeof VERIFICATION_LABELS;

export function VerificationBadge({ verification }: { verification: Verification }) {
  const meta = VERIFICATION_LABELS[verification];
  const variant = verification === "verified" ? "primary" : verification === "estimated" ? "warning" : verification === "community" ? "info" : "default";
  const Icon = verification === "verified" ? BadgeCheck : verification === "estimated" ? CircleAlert : verification === "community" ? Users : User;
  return (
    <Badge variant={variant} title={meta.description}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}
