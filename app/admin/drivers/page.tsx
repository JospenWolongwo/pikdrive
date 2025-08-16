"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Filter,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow } from "date-fns";
import DriverDetail from "./driver-detail";
import { updateDriverStatus as updateDriverStatusUtil } from "@/lib/driver-application-utils";

interface DriverApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  avatar_url?: string;
  driver_status: string;
  created_at: string;
  is_driver?: boolean;
  role?: string;
  source?: string;
  documents: {
    id?: string;
    driver_id?: string;
    national_id_number: string;
    license_number: string;
    registration_number: string;
    insurance_number: string;
    technical_inspection_number: string;
    national_id_file_recto: string;
    national_id_file_verso: string;
    license_file_recto: string;
    license_file_verso: string;
    registration_file_recto: string;
    registration_file_verso: string;
    insurance_file_recto: string;
    insurance_file_verso: string;
    technical_inspection_file: string;
    vehicle_images: string[];
    status: string;
  };
}

export default function AdminDriversPage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] =
    useState<DriverApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const checkAdminAccess = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        toast({
          title: "Accès Refusé",
          description: "Vous n'avez pas la permission d'accéder à cette page.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/");
    }
  }, [supabase, router]);

  // Create an admin client that bypasses RLS for admin operations
  const createAdminClient = useCallback(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey =
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    console.log("🔍 Admin client setup check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyPreview: supabaseServiceKey
        ? `${supabaseServiceKey.substring(0, 20)}...`
        : "undefined",
    });

    // If we have a service role key, create an admin client
    if (supabaseServiceKey) {
      console.log("🔑 Creating admin client with service role...");
      const { createClient } = require("@supabase/supabase-js");
      return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    // Fallback to regular client
    console.log("⚠️ No service role key available, using regular client...");
    return supabase;
  }, [supabase]);

  const loadApplications = useCallback(async () => {
    try {
      console.log("🔄 Loading driver applications from database...");
      setLoading(true);

      // Try to use admin client to bypass RLS restrictions
      const adminClient = createAdminClient();

      // NEW APPROACH: Load profiles with driver applications and their documents
      console.log("🔍 Querying profiles table for driver applicants...");
      const { data: driverProfiles, error: profilesError } = await adminClient
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          city,
          avatar_url,
          is_driver,
          driver_status,
          role,
          driver_application_status,
          driver_application_date,
          is_driver_applicant,
          created_at,
          updated_at
        `
        )
        .eq("is_driver_applicant", true);

      // Log complete data from the admin client query
      console.log("📊 Admin client query for profiles:", {
        success: !profilesError,
        count: driverProfiles?.length || 0,
        error: profilesError ? String(profilesError) : null,
      });

      // Check auth context to debug potential role issues
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      console.log("🔐 Current auth context:", {
        userId: currentUser?.id,
        email: currentUser?.email,
        role: currentUser?.app_metadata?.role || "none set",
      });

      // Use the admin client results directly
      if (profilesError) {
        console.error("❌ Error fetching driver profiles:", profilesError);
        setApplications([]);
        setLoading(false);
        return;
      }

      console.log(
        "📝 Found",
        driverProfiles?.length || 0,
        "driver applicant profiles"
      );

      // Now load documents for each driver
      let driverApplications: DriverApplication[] = [];

      if (driverProfiles && driverProfiles.length > 0) {
        console.log("📄 Sample driver profiles:", driverProfiles.slice(0, 3));

        // For each driver profile, try to load their documents
        driverApplications = await Promise.all(
          driverProfiles.map(async (profile: any) => {
            // Try to load documents for this driver
            const { data: documents } = await adminClient
              .from("driver_documents")
              .select("*")
              .eq("driver_id", profile.id)
              .maybeSingle();

            return {
              id: profile.id,
              full_name: profile.full_name || "Unknown Driver",
              email: profile.email || "No email provided",
              phone: profile.phone || "No phone provided",
              city: profile.city || "No location provided",
              avatar_url: profile.avatar_url,
              driver_status: profile.driver_status || "pending",
              is_driver: profile.is_driver,
              role: profile.role,
              created_at: profile.created_at,
              documents: documents,
              source: "profile",
            };
          })
        );
      }

      console.log(
        "📝 Final driver applications from profiles:",
        driverApplications.length
      );

      if (driverApplications.length > 0) {
        console.log(
          "Sample applications:",
          driverApplications.slice(0, 3).map((app) => ({
            id: app.id,
            full_name: app.full_name,
            email: app.email,
            phone: app.phone,
            city: app.city,
            driver_status: app.driver_status,
            has_documents: Boolean(app.documents),
            docId: app.documents?.id || "no documents",
          }))
        );
      }

      setApplications(driverApplications);
      console.log(
        "✅ Successfully loaded",
        driverApplications.length,
        "driver applications"
      );
    } catch (error) {
      console.error("❌ Error loading applications:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les candidatures de conducteurs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, createAdminClient]);

  useEffect(() => {
    checkAdminAccess();
    loadApplications();
  }, [checkAdminAccess, loadApplications]);

  const handleUpdateDriverStatus = async (driverId: string, status: string) => {
    try {
      console.log(`🔄 Updating driver ${driverId} status to ${status}`);

      // Create admin client for elevated permissions
      const adminClient = createAdminClient();

      // Use the utility function for consistent status updates
      const result = await updateDriverStatusUtil(
        adminClient,
        driverId,
        status as "approved" | "rejected" | "inactive"
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to update driver status");
      }

      // Update local state
      setApplications((prevApplications) =>
        prevApplications.map((app) =>
          app.id === driverId ? { ...app, driver_status: status } : app
        )
      );

      // Close dialog if open
      if (isDetailOpen && selectedApplication?.id === driverId) {
        setIsDetailOpen(false);
        setSelectedApplication(null);
      }

      toast({
        title: "Succès",
        description: `Statut du conducteur mis à jour en ${
          status === "approved"
            ? "approuvé"
            : status === "rejected"
            ? "refusé"
            : status
        }.`,
      });

      // Reload applications to get fresh data
      setTimeout(() => {
        loadApplications();
      }, 1000);
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour le statut du conducteur.",
        variant: "destructive",
      });
    }
  };

  const handleViewApplication = (application: DriverApplication) => {
    setSelectedApplication(application);
    setIsDetailOpen(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-amber-100 text-amber-800";
    }
  };

  const handleManualRefresh = () => {
    setLoading(true);
    // Force data reload with a small delay to ensure we get fresh data
    setTimeout(() => {
      loadApplications();
    }, 300);
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Candidatures de Conducteurs
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérer les candidatures de conducteurs et leur statut de
            vérification.
          </p>
        </div>
        <Button
          onClick={handleManualRefresh}
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvés</TabsTrigger>
          <TabsTrigger value="rejected">Refusés</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map((status) => (
          <TabsContent key={status} value={status}>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conducteur</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Debug what we have in the applications state */}
                  {applications.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Aucune candidature de conducteur trouvée. Vérifiez la
                        console pour les informations de débogage.
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Show a message if no applications are found */}
                  {applications.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Aucune candidature de conducteur trouvée.
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Filter applications by status (profile status is the source of truth) */}
                  {applications
                    .filter((app) => {
                      // We ONLY use profile's driver_status field now as the single source of truth
                      return app.driver_status === status;
                    })
                    .map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={application.avatar_url || ""} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                                {application.full_name
                                  ? application.full_name
                                      .charAt(0)
                                      .toUpperCase()
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {application.full_name
                                  ? application.full_name
                                  : "Unknown Driver"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {application.city}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{application.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {application.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {application.documents ? (
                            <div className="space-y-1">
                              <div>
                                Permis:{" "}
                                {application.documents.license_number ||
                                  "Soumis"}
                              </div>
                              <div>
                                Carte grise:{" "}
                                {application.documents.registration_number ||
                                  "Soumis"}
                              </div>
                              <div>
                                Assurance:{" "}
                                {application.documents.insurance_number ||
                                  "Soumis"}
                              </div>
                              {/* Add debug info to see what documents we have */}
                              <div className="text-xs text-muted-foreground">
                                {application.documents.license_file_recto
                                  ? "✓"
                                  : "✗"}{" "}
                                Fichier permis
                                {application.documents.national_id_file_recto
                                  ? "✓"
                                  : "✗"}{" "}
                                Fichier d&apos;identité (Recto)
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Aucun document soumis
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {/* Use profile's driver_status as the source of truth */}
                          <Badge
                            className={getStatusBadgeColor(
                              application.driver_status
                            )}
                          >
                            {application.driver_status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {/* View Documents Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => handleViewApplication(application)}
                            >
                              <Eye className="h-4 w-4" /> Voir
                            </Button>

                            {/* Show approval buttons only for pending applications */}
                            {application.driver_status === "pending" && (
                              <>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="flex items-center gap-1"
                                    >
                                      <CheckCircle className="h-4 w-4" />{" "}
                                      Approuver
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Approuver la candidature du conducteur
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Êtes-vous sûr de vouloir approuver ce
                                        conducteur ? Il pourra créer des trajets
                                        et recevoir des réservations.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Annuler
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleUpdateDriverStatus(
                                            application.id,
                                            "approved"
                                          )
                                        }
                                      >
                                        Approuver
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="flex items-center gap-1"
                                    >
                                      <XCircle className="h-4 w-4" /> Rejeter
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Rejeter la candidature du conducteur
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Êtes-vous sûr de vouloir rejeter ce
                                        conducteur ? Il ne pourra pas créer de
                                        trajets.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Annuler
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleUpdateDriverStatus(
                                            application.id,
                                            "rejected"
                                          )
                                        }
                                      >
                                        Rejeter
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Search and filter section for future enhancement */}
      <div className="mt-6 flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Rechercher des conducteurs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
            disabled={loading}
            // Removed prefix prop as it's not supported by the Input component
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => loadApplications()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Detail view drawer */}
      {selectedApplication && (
        <DriverDetail
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          driver={selectedApplication}
          onApprove={(id) => handleUpdateDriverStatus(id, "approved")}
          onReject={(id) => handleUpdateDriverStatus(id, "rejected")}
        />
      )}
    </div>
  );
}
