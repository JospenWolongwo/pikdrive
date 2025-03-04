"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
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

interface DriverApplication {
  id: string
  full_name: string
  email: string
  phone: string
  city: string
  avatar_url?: string
  driver_status: string
  created_at: string
  documents: {
    national_id_number: string
    license_number: string
    registration_number: string
    insurance_number: string
    road_tax_number: string
    technical_inspection_number: string
    vehicle_images: string[]
    status: string
  }
}

export default function AdminDriversPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdminAccess()
    loadApplications()
  }, [])

  const checkAdminAccess = async () => {
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
  }

  const loadApplications = async () => {
    try {
      setLoading(true)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          city,
          avatar_url,
          driver_status,
          created_at,
          driver_documents (
            national_id_number,
            license_number,
            registration_number,
            insurance_number,
            road_tax_number,
            technical_inspection_number,
            vehicle_images,
            status
          )
        `)
        .eq("is_driver", true)
        .order("created_at", { ascending: false })

      if (profilesError) throw profilesError

      setApplications(profiles.map((profile: {
        id: string;
        full_name: string;
        email: string;
        phone: string;
        city: string;
        avatar_url?: string;
        driver_status: string;
        created_at: string;
        driver_documents?: Array<{
          national_id_number: string;
          license_number: string;
          registration_number: string;
          insurance_number: string;
          road_tax_number: string;
          technical_inspection_number: string;
          vehicle_images: string[];
          status: string;
        }>;
      }) => ({
        ...profile,
        documents: profile.driver_documents?.[0] || null
      })))
    } catch (error) {
      console.error("Error loading applications:", error)
      toast({
        title: "Error",
        description: "Failed to load driver applications.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateDriverStatus = async (driverId: string, status: string) => {
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ driver_status: status })
        .eq("id", driverId)

      if (profileError) throw profileError

      const { error: documentError } = await supabase
        .from("driver_documents")
        .update({ status })
        .eq("driver_id", driverId)

      if (documentError) throw documentError

      toast({
        title: "Status Updated",
        description: `Driver status has been updated to ${status}.`,
      })

      loadApplications()
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update driver status.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500"
      case "rejected":
        return "bg-red-500"
      default:
        return "bg-yellow-500"
    }
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Driver Applications</h1>
        <p className="text-muted-foreground mt-2">
          Manage driver applications and their verification status.
        </p>
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
                  {applications
                    .filter((app) => app.driver_status === status)
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
                              <div>License: {application.documents.license_number}</div>
                              <div>Registration: {application.documents.registration_number}</div>
                              <div>Insurance: {application.documents.insurance_number}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No documents</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(application.driver_status)}>
                            {application.driver_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {application.driver_status === "pending" && (
                            <div className="flex gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="default">Approve</Button>
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
                                  <Button variant="destructive">Reject</Button>
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
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
