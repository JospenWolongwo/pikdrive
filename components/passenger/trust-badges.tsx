import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle } from "lucide-react";

interface TrustBadgesProps {
  verificationStatus: string;
  driverStatus: string;
}

export function TrustBadges({
  verificationStatus,
  driverStatus,
}: TrustBadgesProps) {
  const isVerified = verificationStatus === "approved" && driverStatus === "approved";

  if (!isVerified) {
    return null;
  }

  const badges = [
    {
      label: "ID vérifié",
      description: "Identité vérifiée",
    },
    {
      label: "Permis vérifié",
      description: "Permis de conduire vérifié",
    },
    {
      label: "Assurance vérifiée",
      description: "Assurance véhicule vérifiée",
    },
  ];

  return (
    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-full">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Conducteur vérifié par PikDrive
              </h3>
              <p className="text-sm text-muted-foreground">
                Tous les documents ont été vérifiés
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="gap-1.5 bg-white/80 dark:bg-gray-800/80"
              >
                <CheckCircle className="h-3 w-3 text-green-600" />
                {badge.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

