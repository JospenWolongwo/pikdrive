import { useLocale } from "@/hooks";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  readonly status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLocale();

  const statusConfig = {
    approved: {
      color: "bg-green-100 text-green-800",
      icon: CheckCircle,
      text: t("pages.profile.status.approved"),
    },
    pending: {
      color: "bg-yellow-100 text-yellow-800",
      icon: AlertCircle,
      text: t("pages.profile.status.pending"),
    },
    rejected: {
      color: "bg-red-100 text-red-800",
      icon: X,
      text: t("pages.profile.status.rejected"),
    },
    inactive: {
      color: "bg-gray-100 text-gray-800",
      icon: X,
      text: t("pages.profile.status.inactive"),
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <IconComponent className="w-3 h-3" />
      {config.text}
    </Badge>
  );
}

