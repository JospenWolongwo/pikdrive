"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Loader2, RefreshCw, Eye, CheckCircle, XCircle, Filter, Search } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { format, formatDistanceToNow } from "date-fns"
import DriverDetail from "./driver-detail"

interface DriverApplication {
  id: string
  full_name: string
  email: string
  phone: string
  city: string
  avatar_url?: string
  driver_status: string
  created_at: string
  is_driver?: boolean
  role?: string
  source?: string
  documents: {
    id?: string
    driver_id?: string
    national_id_number: string
    license_number: string
    registration_number: string
    insurance_number: string
    technical_inspection_number: string
    national_id_file: string
    license_file: string
    registration_file: string
    insurance_file: string
    technical_inspection_file: string
    vehicle_images: string[]
    status: string
  }
}

export default function AdminDriversPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedApplication, setSelectedApplication] = useState<DriverApplication | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const checkAdminAccess = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push("/auth")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single()

      if (profile?.role !== "admin") {
        router.push("/")
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error checking admin access:", error)
      router.push("/")
    }
  }, [supabase, router]);

  const loadApplications = useCallback(async () => {
    try {
      console.log("🔄 Loading driver applications from database...");
      setLoading(true);
      
      // COMPREHENSIVE APPROACH: Fetch both profile-based drivers AND document-based drivers
      // Step 1: Get all drivers from profiles table (has is_driver = true)
      const { data: allDriverProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          city,
          avatar_url,
          driver_status,
          is_driver,
          role,
          created_at
        `)
        .eq("is_driver", true)
        .order("created_at", { ascending: false });
      
      if (profilesError) {
        console.error("❌ Error fetching driver profiles:", profilesError);
        throw profilesError;
      }
      
      console.log("📊 Found", allDriverProfiles?.length || 0, "drivers in profiles table");
      
      // Step 2: Get ALL driver documents (even those without complete profiles)
      // NOTE: We need to query explicitly without any filters to find ALL documents
      console.log("🔍 Searching for ALL driver documents in the database...");
      
      const { data: allDriverDocs, error: allDocsError } = await supabase
        .from("driver_documents")
        .select(`
          id,
          driver_id,
          national_id_number,
          license_number,
          registration_number,
          insurance_number,
          technical_inspection_number,
          national_id_file,
          license_file,
          registration_file,
          insurance_file,
          technical_inspection_file,
          vehicle_images,
          status,
          created_at
        `);
      // We removed the order clause to get ALL documents
      
      if (allDocsError) {
        console.error("❌ Error fetching all driver documents:", allDocsError);
        // Continue with just profile data if we can't get docs
      } else {
        console.log("📝 Found", allDriverDocs?.length || 0, "driver document records");
        
        if (allDriverDocs && allDriverDocs.length > 0) {
          // Detailed logging of the first few records to debug
          console.log("📄 Sample document records:", allDriverDocs.slice(0, 2).map((doc: any) => ({
            id: doc.id,
            driver_id: doc.driver_id,
            has_license: Boolean(doc.license_file),
            has_national_id: Boolean(doc.national_id_file),
            status: doc.status || 'unknown'
          })));
        }
      }
      
      // Step 3: Collect ALL unique driver IDs from both sources
      const profileDriverIds = allDriverProfiles?.map((p: any) => p.id) || [];
      const docDriverIds = allDriverDocs?.map((d: any) => d.driver_id).filter(Boolean) || [];
      const allDriverIds = [...new Set([...profileDriverIds, ...docDriverIds])];
      
      console.log("📃 Total unique drivers from all sources:", allDriverIds.length);
      
      // Step A: If no drivers at all, return empty state
      if (allDriverIds.length === 0) {
        console.log("No drivers found from any source, displaying empty state");
        setApplications([]);
        setLoading(false);
        return;
      }
      
      // Step 4: Fetch any profiles we don't have yet (drivers who submitted docs but haven't completed profile)
      const missingProfileIds = docDriverIds.filter((id: string) => !profileDriverIds.includes(id));
      let additionalProfiles: any[] = [];
      
      if (missingProfileIds.length > 0) {
        console.log("🔎 Found", missingProfileIds.length, "drivers with documents but incomplete profiles");
        
        const { data: moreProfiles, error: moreProfilesError } = await supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            email,
            phone,
            city,
            avatar_url,
            driver_status,
            is_driver,
            role,
            created_at
          `)
          .in("id", missingProfileIds);
          
        if (!moreProfilesError && moreProfiles) {
          additionalProfiles = moreProfiles;
          console.log("👥 Retrieved", additionalProfiles.length, "additional driver profiles");
        }
      }
      
      // Step 5: Combine all profiles we found
      const allProfiles = [...(allDriverProfiles || []), ...additionalProfiles];
      
      // Step 6: Create maps for easy lookup
      const profileMap: Record<string, any> = {};
      allProfiles.forEach(profile => {
        profileMap[profile.id] = profile;
      });
      
      const docMap: Record<string, any> = {};
      if (allDriverDocs) {
        allDriverDocs.forEach((doc: any) => {
          if (doc.driver_id) {
            docMap[doc.driver_id] = doc;
          }
        });
      }
      
      // ADDITIONAL STEP: Also directly query driver documents to get ALL potential drivers
      console.log("🔎 Getting a complete list of driver applications from both profiles and documents...");
      
      // Step 7: Build the final combined applications list
      let combinedApplications: DriverApplication[] = [];
      
      // First, add all drivers from profiles
      allProfiles.forEach(profile => {
        const documents = docMap[profile.id] || null;
        combinedApplications.push({
          ...profile,
          documents,
          // Use document status as fallback if profile status is missing
          driver_status: profile.driver_status || (documents?.status || 'pending'),
          source: 'profile'
        });
      });
      
      // Then, add any drivers from documents who don't have profiles yet
      if (allDriverDocs) {
        allDriverDocs.forEach((doc: any) => {
          // Skip if we already added this driver from profiles
          if (doc.driver_id && !profileMap[doc.driver_id]) {
            console.log("💡 Found document-only driver:", doc.driver_id);
            
            // Create a synthetic profile for this document-only driver
            combinedApplications.push({
              id: doc.driver_id,
              full_name: "Driver " + doc.driver_id.substring(0, 8),
              email: "Unknown",
              phone: "",
              city: "",
              avatar_url: "",
              driver_status: doc.status || "pending",
              is_driver: true,
              role: "user",
              created_at: doc.created_at,
              documents: doc,
              source: 'document'
            });
          }
        });
      }
      
      // Final safety check to ensure we only show drivers
      combinedApplications = combinedApplications.filter(app => app.is_driver);
      
      // Debug output the combined data
      console.log("📝 Final combined applications:", combinedApplications.length);
      
      if (combinedApplications.length > 0) {
        console.log("Sample applications:", combinedApplications.slice(0, 3).map(app => ({
          id: app.id,
          name: app.full_name,
          profileStatus: app.driver_status,
          hasDocuments: Boolean(app.documents),
          docId: app.documents?.id || 'no documents',
          docStatus: app.documents?.status || 'N/A'
        })));
      }
      
      setApplications(combinedApplications);
      console.log("✅ Successfully loaded", combinedApplications.length, "driver applications");
    } catch (error) {
      console.error("❌ Error loading applications:", error);
      toast({
        title: "Error",
        description: "Failed to load driver applications.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    checkAdminAccess()
    loadApplications()
  }, [checkAdminAccess, loadApplications]);

  const updateDriverStatus = async (driverId: string, status: string) => {
    try {
      console.log(`Updating driver ${driverId} status to ${status}`);
      
      // Update profile status which is our source of truth
      const { error } = await supabase
        .from("profiles")
        .update({ driver_status: status })
        .eq("id", driverId);

      if (error) throw error;

      // Also update document status if it exists (for consistency)
      const { data: docData } = await supabase
        .from("driver_documents")
        .select('id')
        .eq("driver_id", driverId)
        .maybeSingle();
      
      if (docData?.id) {
        console.log(`Also updating document record ${docData.id} for consistency`);
        const { error: docError } = await supabase
          .from("driver_documents")
          .update({ status: status })
          .eq("id", docData.id);
          
        if (docError) {
          console.error("Error updating document status:", docError);
          // Continue anyway since profile is updated
        }
      }
      
      // Update local state
      setApplications(prevApplications => 
        prevApplications.map(app => 
          app.id === driverId ? { ...app, driver_status: status } : app
        )
      );

      // Close dialog if open
      if (isDetailOpen && selectedApplication?.id === driverId) {
        setIsDetailOpen(false);
        setSelectedApplication(null);
      }

      toast({
        title: "Success",
        description: `Driver status updated to ${status}.`,
      });
    } catch (error) {
      console.error("Error updating driver status:", error)
      toast({
        title: "Error",
        description: "Failed to update driver status.",
        variant: "destructive",
      })
    }
  }

  const handleViewApplication = (application: DriverApplication) => {
    setSelectedApplication(application);
    setIsDetailOpen(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch(status) {
      case "approved": return "bg-green-100 text-green-800"
      case "rejected": return "bg-red-100 text-red-800"
      default: return "bg-amber-100 text-amber-800"
    }
  }

  const handleManualRefresh = () => {
    setLoading(true);
    // Force data reload with a small delay to ensure we get fresh data
    setTimeout(() => {
      loadApplications();
    }, 300);
  };
  
  return (
    <div className="container py-10">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Driver Applications</h1>
          <p className="text-muted-foreground mt-2">
            Manage driver applications and their verification status.
          </p>
        </div>
        <Button 
          onClick={handleManualRefresh} 
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map((status) => (
          <TabsContent key={status} value={status}>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Debug what we have in the applications state */}
                  {applications.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No driver applications found. Check the console for debugging information.
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Show a message if no applications are found */}
                  {applications.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No driver applications found.
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
                              <AvatarFallback>
                                {application.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {application.full_name}
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
                              <div>License: {application.documents.license_number || 'Submitted'}</div>
                              <div>Registration: {application.documents.registration_number || 'Submitted'}</div>
                              <div>Insurance: {application.documents.insurance_number || 'Submitted'}</div>
                              {/* Add debug info to see what documents we have */}
                              <div className="text-xs text-muted-foreground">
                                {application.documents.license_file ? '✓' : '✗'} License File
                                {application.documents.national_id_file ? '✓' : '✗'} ID File
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No documents submitted</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {/* Use profile's driver_status as the source of truth */}
                          <Badge className={getStatusBadgeColor(application.driver_status)}>
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
                              <Eye className="h-4 w-4" /> View
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
                                      <CheckCircle className="h-4 w-4" /> Approve
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Driver Application</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to approve this driver? They will be able to create rides and receive bookings.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => updateDriverStatus(application.id, "approved")}
                                      >
                                        Approve
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
                                      <XCircle className="h-4 w-4" /> Reject
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reject Driver Application</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to reject this driver? They will not be able to create rides.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => updateDriverStatus(application.id, "rejected")}
                                      >
                                        Reject
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
            placeholder="Search drivers..." 
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
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {/* Detail view drawer */}
      {selectedApplication && (
        <DriverDetail
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          driver={selectedApplication}
          onApprove={(id) => updateDriverStatus(id, "approved")}
          onReject={(id) => updateDriverStatus(id, "rejected")}
        />
      )}
    </div>
  )
}


