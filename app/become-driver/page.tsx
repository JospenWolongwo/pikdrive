"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Car, CheckCircle2, DollarSign, ShieldCheck, Upload } from "lucide-react"

const requirements = [
  {
    icon: <Car className="w-6 h-6 text-primary" />,
    title: "Vehicle Requirements",
    items: [
      "Vehicle less than 10 years old",
      "4-door sedan or SUV",
      "Valid technical inspection",
      "Comprehensive insurance",
      "Air conditioning"
    ]
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Driver Requirements",
    items: [
      "Valid Cameroonian driver's license",
      "Minimum 3 years driving experience",
      "Clean driving record",
      "Professional appearance",
      "Smartphone with data plan"
    ]
  },
  {
    icon: <DollarSign className="w-6 h-6 text-primary" />,
    title: "Earnings",
    items: [
      "Keep 80% of the fare",
      "Weekly payments",
      "Bonus opportunities",
      "Flexible schedule",
      "Peak hour incentives"
    ]
  }
]

const faqs = [
  {
    question: "How long does the application process take?",
    answer: "The application process typically takes 3-5 business days. This includes document verification, background check, and vehicle inspection if applicable."
  },
  {
    question: "What documents do I need to apply?",
    answer: "You'll need your valid driver's license, national ID card, vehicle registration (if using your own vehicle), proof of insurance, and proof of residence."
  },
  {
    question: "Can I use a rented vehicle?",
    answer: "Yes, you can use a rented vehicle as long as it meets our vehicle requirements and you have proper documentation showing your right to use the vehicle."
  },
  {
    question: "How do I get paid?",
    answer: "Payments are made weekly via mobile money (Orange Money or MTN Mobile Money). You can track your earnings in real-time through the driver app."
  },
  {
    question: "What support do drivers receive?",
    answer: "Drivers receive 24/7 support, access to our driver community, regular training sessions, and assistance with vehicle maintenance partnerships."
  }
]

const formSchema = z.object({
  // Personal Information
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^(?:\+237|237)?[6-9][0-9]{8}$/, "Invalid Cameroonian phone number"),
  dateOfBirth: z.string(),
  address: z.string().min(10, "Please provide your full address"),
  city: z.string().min(2, "Please select your city"),
  
  // Driver Information
  licenseNumber: z.string().min(5, "Invalid license number"),
  licenseExpiry: z.string(),
  yearsOfExperience: z.string(),
  languages: z.string().array().min(1, "Select at least one language"),
  
  // Vehicle Information
  hasVehicle: z.string(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehiclePlate: z.string().optional(),
  
  // Additional Information
  preferredAreas: z.string(),
  availability: z.string(),
  backgroundInfo: z.string(),
})

export default function BecomeDriverPage() {
  const [step, setStep] = useState(1)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      city: "",
      licenseNumber: "",
      licenseExpiry: "",
      yearsOfExperience: "",
      languages: [],
      hasVehicle: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehiclePlate: "",
      preferredAreas: "",
      availability: "",
      backgroundInfo: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
    // Handle form submission
  }

  const renderFormStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+237 6XX XXX XXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter your full address" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your city" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="douala">Douala</SelectItem>
                      <SelectItem value="yaounde">Yaoundé</SelectItem>
                      <SelectItem value="bafoussam">Bafoussam</SelectItem>
                      <SelectItem value="bamenda">Bamenda</SelectItem>
                      <SelectItem value="kribi">Kribi</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Driver Information</h3>
            <FormField
              control={form.control}
              name="licenseNumber"
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
              name="licenseExpiry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="yearsOfExperience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of Driving Experience</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select years of experience" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Upload Documents</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Driver's License (Front)</p>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Driver's License (Back)</p>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">National ID</p>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Profile Photo</p>
                </div>
              </div>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Vehicle Information</h3>
            <FormField
              control={form.control}
              name="hasVehicle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Do you have a vehicle?</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes, I have my own vehicle</SelectItem>
                      <SelectItem value="no">No, I need a vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("hasVehicle") === "yes" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicleMake"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Make</FormLabel>
                        <FormControl>
                          <Input placeholder="Toyota" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Corolla" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicleYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input placeholder="2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehiclePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Plate</FormLabel>
                        <FormControl>
                          <Input placeholder="CE 123 AB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Upload Vehicle Documents</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Vehicle Registration</p>
                    </div>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Insurance Certificate</p>
                    </div>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Technical Inspection</p>
                    </div>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Vehicle Photos</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Additional Information</h3>
            <FormField
              control={form.control}
              name="preferredAreas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Operating Areas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="List the areas/cities where you prefer to operate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your availability" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="full-time">Full Time</SelectItem>
                      <SelectItem value="part-time">Part Time</SelectItem>
                      <SelectItem value="weekends">Weekends Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="backgroundInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Background Information</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell us about your driving experience and why you want to join WakaYamo"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="container py-16 space-y-16">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Become a WakaYamo Driver</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join our growing community of professional drivers and earn money on your own schedule.
        </p>
      </div>

      {/* Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {requirements.map((req, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              {req.icon}
              <h3 className="text-xl font-semibold">{req.title}</h3>
            </div>
            <ul className="space-y-3">
              {req.items.map((item, i) => (
                <li key={i} className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Application Form */}
      <div className="max-w-3xl mx-auto">
        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Progress Indicator */}
              <div className="flex justify-between mb-8">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 
                      ${step === s ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'}`}
                  >
                    {s}
                  </div>
                ))}
              </div>

              {renderFormStep()}

              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={step === 1}
                >
                  Previous
                </Button>
                <Button
                  type={step === 4 ? "submit" : "button"}
                  onClick={() => step < 4 && setStep(step + 1)}
                >
                  {step === 4 ? "Submit Application" : "Next"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>

      {/* FAQs */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}