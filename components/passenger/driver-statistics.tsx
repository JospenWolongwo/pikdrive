import { Card, CardContent } from "@/components/ui/card";
import { Users, MapPin, Calendar } from "lucide-react";

interface DriverStatisticsProps {
  totalTrips: number;
  totalPassengers: number;
  memberSince: string;
}

export function DriverStatistics({
  totalTrips,
  totalPassengers,
  memberSince,
}: DriverStatisticsProps) {
  const stats = [
    {
      label: "Trajets réalisés",
      value: totalTrips,
      icon: MapPin,
      description: "Trajets complétés",
    },
    {
      label: "Passagers transportés",
      value: totalPassengers,
      icon: Users,
      description: "Passagers au total",
    },
    {
      label: "Membre depuis",
      value: memberSince,
      icon: Calendar,
      description: "Date d'inscription",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-foreground mb-1">
                    {typeof stat.value === "number"
                      ? stat.value.toLocaleString()
                      : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
                <div className="ml-4 p-3 bg-primary/10 rounded-full">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

