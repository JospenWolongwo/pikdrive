"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Car, UserCheck } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();

  const adminModules = [
    {
      title: "Driver Management",
      description: "Review and manage driver applications",
      icon: Users,
      href: "/admin/drivers",
    },
    {
      title: "Passenger Management",
      description: "View and manage passenger information",
      icon: UserCheck,
      href: "/admin/passengers",
    },
    // Add more admin modules here as needed
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage your platform and users from here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map((module) => (
          <Card
            key={module.title}
            className="p-6 hover:bg-accent transition-colors cursor-pointer"
            onClick={() => router.push(module.href)}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <module.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{module.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
