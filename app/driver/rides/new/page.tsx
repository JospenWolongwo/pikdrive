"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { urbanCommunes, cameroonCities } from "@/app/data/cities"

const formSchema = z.object({
  fromCity: z.string().min(1, "From city is required"),
  toCity: z.string().min(1, "To city is required"),
  departureTime: z.date({
    required_error: "Departure time is required",
  }),
  price: z.number().min(1, "Price is required"),
  totalSeats: z.number().min(1, "Total seats is required"),
  seatsAvailable: z.number()
    .min(1, "Available seats is required")
    .max(100, "Cannot exceed 100 seats"),
  carModel: z.string().min(1, "Car model is required"),
  carColor: z.string().min(1, "Car color is required"),
  carYear: z.string().min(1, "Car year is required"),
}).refine((data) => {
  return data.seatsAvailable <= data.totalSeats;
}, {
  message: "Available seats cannot exceed total seats",
  path: ["seatsAvailable"], // This tells Zod to show error on seatsAvailable field
});

export default function NewRidePage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create a sorted list of all cities
  const allCities = [...Array.from(urbanCommunes), ...Array.from(cameroonCities)].sort()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCity: "",
      toCity: "",
      price: 0,
      totalSeats: 0,
      seatsAvailable: 0,
      carModel: "",
      carColor: "",
      carYear: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a ride.",
        variant: "destructive",
      })
      router.push("/auth")
      return
    }

    try {
      setIsSubmitting(true)

      // Get current time in UTC
      const now = new Date()
      const nowUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      ))

      // Convert departure time to UTC
      const departureUTC = new Date(Date.UTC(
        values.departureTime.getUTCFullYear(),
        values.departureTime.getUTCMonth(),
        values.departureTime.getUTCDate(),
        values.departureTime.getUTCHours(),
        values.departureTime.getUTCMinutes(),
        values.departureTime.getUTCSeconds()
      ))

      console.log("Creating ride with data:", {
        driver_id: user.id,
        from_city: values.fromCity,
        to_city: values.toCity,
        departure_time: departureUTC.toISOString(),
        departure_timestamp: departureUTC.getTime(),
        current_timestamp: nowUTC.getTime(),
        difference_hours: (departureUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60),
        price: values.price,
        seats_available: values.seatsAvailable,
        total_seats: values.totalSeats,
        car_model: values.carModel,
        car_color: values.carColor,
        car_year: values.carYear,
      })

      // Ensure the departure time is in the future
      if (departureUTC.getTime() <= nowUTC.getTime()) {
        toast({
          title: "Invalid Departure Time",
          description: "The departure time must be in the future.",
          variant: "destructive",
        })
        return
      }

      // First create the ride
      const { data: newRide, error: createError } = await supabase
        .from("rides")
        .insert({
          driver_id: user.id,
          from_city: values.fromCity,
          to_city: values.toCity,
          departure_time: departureUTC.toISOString(), // Store as UTC ISO string
          price: values.price,
          seats_available: values.seatsAvailable,
          total_seats: values.totalSeats,
          car_model: values.carModel,
          car_color: values.carColor,
          car_year: values.carYear,
        })
        .select()
        .single()

      if (createError) {
        console.error("Error creating ride:", createError)
        throw createError
      }

      console.log("Created ride:", newRide)

      toast({
        title: "Ride Created",
        description: "Your ride has been created successfully.",
      })

      // Wait a moment to ensure the ride is saved
      await new Promise(resolve => setTimeout(resolve, 500))

      // Use replace instead of push to ensure searchParams change is detected
      router.replace("/driver/dashboard?refresh=true")
    } catch (error) {
      console.error("Error creating ride:", error)
      toast({
        title: "Error",
        description: "There was an error creating your ride. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create New Ride</h1>
          <p className="text-muted-foreground mt-2">
            Fill in the details below to create a new ride.
          </p>
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fromCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From City</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select departure city"
                          searchPlaceholder="Search cities..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="toCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To City</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select destination city"
                          searchPlaceholder="Search cities..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="departureTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Departure Time</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP p")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                        <div className="p-3 border-t">
                          <Input
                            type="time"
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":")
                              const newDate = new Date(field.value || new Date())
                              newDate.setHours(parseInt(hours))
                              newDate.setMinutes(parseInt(minutes))
                              field.onChange(newDate)
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field: { onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Price (FCFA)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g. 5000" 
                          onChange={(e) => onChange(Number(e.target.value))}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalSeats"
                  render={({ field: { onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Total Seats</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g. 4" 
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            onChange(value);
                            // Reset available seats if it exceeds total seats
                            const availableSeats = form.getValues("seatsAvailable");
                            if (availableSeats > value) {
                              form.setValue("seatsAvailable", value);
                            }
                          }}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum number of seats in your vehicle
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="seatsAvailable"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Available Seats</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 4" 
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          const totalSeats = form.getValues("totalSeats");
                          // Don't allow available seats to exceed total seats
                          onChange(Math.min(value, totalSeats));
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of seats available for this ride
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="carModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Car Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Toyota Camry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Car Color</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Black" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Car Year</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2020" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/driver/dashboard")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Ride"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}
