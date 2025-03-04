"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvatarUpload } from "@/components/ui/avatar-upload"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Car, FileText, Shield, User } from "lucide-react"

const driverProfileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  city: z.string().min(2, "City is required"),
  national_id_number: z.string().min(1, "National ID is required"),
  license_number: z.string().min(1, "License number is required"),
  registration_number: z.string().min(1, "Vehicle registration is required"),
  insurance_number: z.string().min(1, "Insurance number is required"),
  road_tax_number: z.string().min(1, "Road tax number is required"),
  technical_inspection_number: z.string().min(1, "Technical inspection number is required"),
  vehicle_make: z.string().min(1, "Vehicle make is required"),
  vehicle_model: z.string().min(1, "Vehicle model is required"),
  vehicle_year: z.string().min(4, "Vehicle year is required"),
  vehicle_color: z.string().min(1, "Vehicle color is required"),
})

type DriverProfileValues = z.infer<typeof driverProfileSchema>

export default function DriverProfilePage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [vehicleImages, setVehicleImages] = useState<string[]>([])

  const form = useForm<DriverProfileValues>({
    resolver: zodResolver(driverProfileSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      city: "",
      national_id_number: "",
      license_number: "",
      registration_number: "",
      insurance_number: "",
      road_tax_number: "",
      technical_inspection_number: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_color: "",
    },
  })

  useEffect(() => {
    if (!user) {
      router.push("/auth")
      return
    }

    const loadProfile = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*, driver_documents (*)")
          .eq("id", user.id)
          .single()

        if (profileError) throw profileError

        if (!profile.is_driver) {
          router.push("/become-driver")
          return
        }

        // Set form values
        form.reset({
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          city: profile.city || "",
          national_id_number: profile.driver_documents?.national_id_number || "",
          license_number: profile.driver_documents?.license_number || "",
          registration_number: profile.driver_documents?.registration_number || "",
          insurance_number: profile.driver_documents?.insurance_number || "",
          road_tax_number: profile.driver_documents?.road_tax_number || "",
          technical_inspection_number: profile.driver_documents?.technical_inspection_number || "",
          vehicle_make: profile.driver_documents?.vehicle_make || "",
          vehicle_model: profile.driver_documents?.vehicle_model || "",
          vehicle_year: profile.driver_documents?.vehicle_year || "",
          vehicle_color: profile.driver_documents?.vehicle_color || "",
        })

        setAvatarUrl(profile.avatar_url)
        setVehicleImages(profile.driver_documents?.vehicle_images || [])
      } catch (error) {
        console.error("Error loading profile:", error)
        toast({
          title: "Error",
          description: "Could not load your profile. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, router, supabase, form])

  const onSubmit = async (values: DriverProfileValues) => {
    try {
      setLoading(true)

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          city: values.city,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user!.id)

      if (profileError) throw profileError

      // Update driver documents
      const { error: documentsError } = await supabase
        .from("driver_documents")
        .update({
          national_id_number: values.national_id_number,
          license_number: values.license_number,
          registration_number: values.registration_number,
          insurance_number: values.insurance_number,
          road_tax_number: values.road_tax_number,
          technical_inspection_number: values.technical_inspection_number,
          vehicle_make: values.vehicle_make,
          vehicle_model: values.vehicle_model,
          vehicle_year: values.vehicle_year,
          vehicle_color: values.vehicle_color,
          updated_at: new Date().toISOString(),
        })
        .eq("driver_id", user!.id)

      if (documentsError) throw documentsError

      toast({
        title: "Profile Updated",
        description: "Your driver profile has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Could not update your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container py-10">Loading...</div>
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Driver Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your driver profile and vehicle information.
        </p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and contact details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <AvatarUpload
                      uid={user!.id}
                      url={avatarUrl}
                      onUpload={(url) => setAvatarUrl(url)}
                      size={150}
                    />
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documents & Licenses
                  </CardTitle>
                  <CardDescription>
                    Your identification and license information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="national_id_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>National ID Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="license_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver's License Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="insurance_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance Policy Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="road_tax_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Road Tax Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="technical_inspection_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technical Inspection Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vehicle">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    Vehicle Information
                  </CardTitle>
                  <CardDescription>
                    Details about your vehicle.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="vehicle_make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Make</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicle_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Model</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicle_year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Year</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicle_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Color</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registration_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Registration Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  )
}
