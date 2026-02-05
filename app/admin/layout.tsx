"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/providers/SupabaseProvider";
import { Button, Card, Separator, Badge } from "@/components/ui";
import {
  Users,
  LayoutDashboard,
  Settings,
  Car,
  FileText,
  TrendingUp,
  Menu,
  X,
  Home,
  ChevronRight,
  MapPin,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { supabase } = useSupabase();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        
        if (userError || !user) {
          router.push("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // If profile doesn't exist or there's an error, deny access
        if (profileError) {
          console.error("Error fetching profile for admin check:", profileError);
          router.push("/");
          return;
        }

        if (!profile || profile.role !== "admin") {
          console.log("Admin access denied:", {
            hasProfile: !!profile,
            role: profile?.role,
            userId: user.id
          });
          router.push("/");
          return;
        }

        // Admin access granted
        console.log("Admin access granted for user:", user.id);
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [supabase, router]);

  const sidebarItems = [
    {
      title: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      description: "Vue d'ensemble",
    },
    {
      title: "Driver Management",
      href: "/admin/drivers",
      icon: Users,
      description: "Gestion des conducteurs",
      badge: "Active",
    },
    {
      title: "Pickup Points",
      href: "/admin/pickup-points",
      icon: MapPin,
      description: "Points de ramassage par ville",
    },
    {
      title: "Vehicle Management",
      href: "/admin/vehicles",
      icon: Car,
      description: "Gestion des véhicules",
      disabled: true,
    },
    {
      title: "Reports",
      href: "/admin/reports",
      icon: TrendingUp,
      description: "Rapports et statistiques",
      disabled: true,
    },
    {
      title: "Documentation",
      href: "/admin/docs",
      icon: FileText,
      description: "Documentation système",
      disabled: true,
    },
    {
      title: "Settings",
      href: "/admin/settings",
      icon: Settings,
      description: "Paramètres système",
      disabled: true,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b bg-gradient-to-r from-primary to-primary/80">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mr-3">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-primary-foreground">
                  Admin Panel
                </h1>
                <p className="text-xs text-primary-foreground/80">
                  PikDrive Administration
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-primary-foreground hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <div key={item.href}>
                    {item.disabled ? (
                      <div className="flex items-center px-4 py-3 text-sm rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed">
                        <Icon className="mr-3 h-5 w-5" />
                        <div className="flex-1">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs">{item.description}</div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Soon
                        </Badge>
                      </div>
                    ) : (
                      <Link href={item.href}>
                        <div
                          className={`flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <Icon
                            className={`mr-3 h-5 w-5 ${
                              isActive ? "text-primary" : "text-gray-500"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-xs text-gray-500">
                              {item.description}
                            </div>
                          </div>
                          {item.badge && (
                            <Badge
                              variant="default"
                              className="text-xs bg-primary/20 text-primary"
                            >
                              {item.badge}
                            </Badge>
                          )}
                          {isActive && <ChevronRight className="h-4 w-4" />}
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            <Separator className="my-6" />

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
                Quick Actions
              </h3>
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to Main Site
                </Button>
              </Link>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t bg-gray-50">
            <Card className="p-3">
              <div className="text-xs text-gray-600">
                <div className="font-medium mb-1">System Status</div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  All systems operational
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <div className="w-10"></div> {/* Spacer for balance */}
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
