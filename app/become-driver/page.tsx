"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Car, CheckCircle2, DollarSign, ShieldCheck, Upload } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

const requirements = [
  {
    icon: <Car className="w-6 h-6 text-primary" />,
    title: "Required Vehicle Documents",
    items: [
      "Vehicle Registration Card",
      "Insurance Certificate",
      "Road Tax Certificate",
      "Technical Inspection Certificate"
    ]
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Required Driver Documents",
    items: [
      "National ID Card (CNI)",
      "Driver's License"
    ]
  },
  {
    icon: <DollarSign className="w-6 h-6 text-primary" />,
    title: "Benefits",
    items: [
      "Earn more with long-distance rides",
      "Weekly payments",
      "Flexible schedule",
      "24/7 Support"
    ]
  }
]

const formSchema = z.object({
  nationalIdNumber: z.string().min(1, "National ID number is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  registrationNumber: z.string().min(1, "Registration number is required"),
  insuranceNumber: z.string().min(1, "Insurance number is required"),
  roadTaxNumber: z.string().min(1, "Road tax number is required"),
  technicalInspectionNumber: z.string().min(1, "Technical inspection number is required"),
  vehicleImages: z.array(z.string()).optional(),
})

export default function BecomeDriverPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [vehicleImages, setVehicleImages] = useState<string[]>([])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nationalIdNumber: "",
      licenseNumber: "",
      registrationNumber: "",
      insuranceNumber: "",
      roadTaxNumber: "",
      technicalInspectionNumber: "",
      vehicleImages: [],
    },
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload images.",
        variant: "destructive",
      })
      return
    }

    if (!e.target.files || e.target.files.length === 0) return

    try {
      setUploadingImages(true)
      const newImages: string[] = []

      // Convert FileList to array for iteration
      const files = Array.from(e.target.files)
      
      for (const file of files) {
        const fileExt = file.name.split(".").pop()
        // Generate a random string for the filename
        const randomString = Math.random().toString(36).substring(2)
        const filePath = `${user.id}/${randomString}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("vehicles")
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from("vehicles")
          .getPublicUrl(filePath)

        newImages.push(publicUrl)
      }

      setVehicleImages(prev => [...prev, ...newImages])
      form.setValue("vehicleImages", [...vehicleImages, ...newImages])
      toast({
        title: "Images uploaded",
        description: "Vehicle images have been uploaded successfully.",
      })
    } catch (error) {
      console.error("Error uploading images:", error)
      toast({
        title: "Error",
        description: "There was an error uploading your images. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingImages(false)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Form submitted with values:", values)
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit your application.",
        variant: "destructive",
      })
      router.push("/auth")
      return
    }

    try {
      setIsSubmitting(true)

      // First, check if user is already a driver
      const { data: profile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("is_driver")
        .eq("id", user.id)
        .single()

      if (profileCheckError) {
        console.error("Error checking profile:", profileCheckError)
        throw profileCheckError
      }

      if (profile?.is_driver) {
        toast({
          title: "Already a Driver",
          description: "You are already registered as a driver.",
          variant: "destructive",
        })
        router.push("/driver/dashboard")
        return
      }

      // Update profile to mark as driver
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_driver: true,
          driver_status: "pending",
        })
        .eq("id", user.id)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        throw profileError
      }

      // Insert driver documents
      const { error: documentError } = await supabase
        .from("driver_documents")
        .insert({
          driver_id: user.id,
          national_id_number: values.nationalIdNumber,
          license_number: values.licenseNumber,
          registration_number: values.registrationNumber,
          insurance_number: values.insuranceNumber,
          road_tax_number: values.roadTaxNumber,
          technical_inspection_number: values.technicalInspectionNumber,
          vehicle_images: vehicleImages,
        })

      if (documentError) {
        console.error("Error inserting documents:", documentError)
        // If document insertion fails, revert the profile update
        await supabase
          .from("profiles")
          .update({
            is_driver: false,
            driver_status: null,
          })
          .eq("id", user.id)
        throw documentError
      }

      toast({
        title: "Application Submitted",
        description: "Your driver application has been submitted for review.",
      })

      // Redirect to driver dashboard
      router.push("/driver/dashboard")
    } catch (error) {
      console.error("Error submitting driver application:", error)
      toast({
        title: "Error",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Become a Driver</h1>
          <p className="text-muted-foreground">
            Join our community of drivers and start earning more with PikDrive.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {requirements.map((section, index) => (
            <Card key={index} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <h3 className="font-semibold">{section.title}</h3>
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-1 text-primary" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Driver Documents</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nationalIdNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>National ID Number (CNI)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your CNI number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver's License Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your license number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Vehicle Documents</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Registration Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter registration number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="insuranceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter insurance number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roadTaxNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Road Tax Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter road tax number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="technicalInspectionNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technical Inspection Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter technical inspection number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Vehicle Images Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Vehicle Images</h3>
                <p className="text-sm text-muted-foreground">
                  Please upload clear images of your vehicle (exterior and interior)
                </p>
                <div className="grid gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImages}
                  />
                  {vehicleImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {vehicleImages.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Vehicle image ${index + 1}`}
                          className="rounded-lg object-cover w-full aspect-video"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || uploadingImages}
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}