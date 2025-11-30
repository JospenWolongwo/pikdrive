"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { allCameroonCities } from "@/app/data/cities";

const formSchema = z.object({
  fromCity: z.string().min(1, "La ville de départ est requise"),
  toCity: z.string().min(1, "La ville de destination est requise"),
  departureTime: z.date({
    required_error: "L'heure de départ est requise",
  }),
  price: z.number().min(1, "Le prix est requis").optional(),
  seatsAvailable: z
    .number()
    .min(1, "Le nombre de places disponibles est requis")
    .max(100, "Ne peut pas dépasser 100 places")
    .optional(),
  carModel: z.string().min(1, "Le modèle de voiture est requis"),
  carColor: z.string().min(1, "La couleur de la voiture est requise"),
});

export default function NewRidePage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [createdRide, setCreatedRide] = useState<{ fromCity: string; toCity: string } | null>(null);
  const { refreshDriverRides, addDriverRide } = useRidesStore();
  const { triggerPrompt } = useNotificationPromptTrigger();

  // Create a sorted list of all cities
  const allCities = allCameroonCities.sort();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCity: "",
      toCity: "",
      price: undefined,
      seatsAvailable: undefined,
      carModel: "",
      carColor: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        title: "Authentification Requise",
        description: "Veuillez vous connecter pour créer un trajet.",
        variant: "destructive",
      });
      router.push("/auth");
      return;
    }

    // Validate that required numeric fields are provided
    if (!values.price || !values.seatsAvailable) {
      toast({
        title: "Champs Requis",
        description: "Le prix et le nombre de places sont requis.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Get current time in UTC
      const now = new Date();
      const nowUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds()
        )
      );

      // Convert departure time to UTC
      const departureUTC = new Date(
        Date.UTC(
          values.departureTime.getUTCFullYear(),
          values.departureTime.getUTCMonth(),
          values.departureTime.getUTCDate(),
          values.departureTime.getUTCHours(),
          values.departureTime.getUTCMinutes(),
          values.departureTime.getUTCSeconds()
        )
      );

      console.log("Creating ride with data:", {
        driver_id: user.id,
        from_city: values.fromCity,
        to_city: values.toCity,
        departure_time: departureUTC.toISOString(),
        departure_timestamp: departureUTC.getTime(),
        current_timestamp: nowUTC.getTime(),
        difference_hours:
          (departureUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60),
        price: values.price,
        seats_available: values.seatsAvailable,
        car_model: values.carModel,
        car_color: values.carColor,
      });

      // Ensure the departure time is in the future
      if (departureUTC.getTime() <= nowUTC.getTime()) {
        toast({
          title: "Heure de Départ Invalide",
          description: "L'heure de départ doit être dans le futur.",
          variant: "destructive",
        });
        return;
      }

      // Create the ride using the API endpoint
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_city: values.fromCity,
          to_city: values.toCity,
          departure_time: departureUTC.toISOString(),
          price: values.price,
          seats_available: values.seatsAvailable,
          car_model: values.carModel,
          car_color: values.carColor,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error creating ride:", result);
        throw new Error(result.error || "Failed to create ride");
      }

      console.log("✅ Created ride:", {
        id: result.data?.id,
        driver_id: result.data?.driver_id,
        from: result.data?.from_city,
        to: result.data?.to_city,
        seats: result.data?.seats_available
      });

      // ✅ OPTIMISTIC UPDATE: Add ride to store immediately (no API call needed!)
      const newRide = {
        ...result.data,
        bookings: [],
        messages: [],
      };
      addDriverRide(newRide);

      // Store ride info for success dialog
      setCreatedRide({
        fromCity: values.fromCity,
        toCity: values.toCity,
      });

      // Show success dialog
      setShowSuccessDialog(true);

      // Trigger notification prompt after ride creation
      // This is a critical moment - driver is actively using the platform
      // Use priority=true to bypass 24h cooldown for critical ride creation events
      triggerPrompt(true);
    } catch (error) {
      console.error("Error creating ride:", error);
      toast({
        title: "Erreur",
        description:
          "Une erreur s'est produite lors de la création de votre trajet. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGoToDashboard = async () => {
    setIsRedirecting(true);
    setShowSuccessDialog(false);
    
    // Small delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Navigate to dashboard
    router.replace("/driver/dashboard");
  };

  return (
    <>
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={(open) => !open && handleGoToDashboard()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="text-2xl">Trajet Créé avec Succès !</DialogTitle>
              <DialogDescription className="text-base">
                {createdRide && (
                  <>
                    Votre trajet <strong>{createdRide.fromCity} → {createdRide.toCity}</strong> est maintenant disponible.
                    <br />
                    <br />
                    Les passagers peuvent maintenant réserver des places sur ce trajet.
                  </>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              onClick={handleGoToDashboard}
              disabled={isRedirecting}
              className="w-full"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirection...
                </>
              ) : (
                "Aller au Tableau de Bord"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Créer un Nouveau Trajet</h1>
          <p className="text-muted-foreground mt-2">
            Remplissez les détails ci-dessous pour créer un nouveau trajet.
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
                      <FormLabel>Ville de Départ</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Sélectionner la ville de départ"
                          searchPlaceholder="Rechercher des villes..."
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
                      <FormLabel>Ville de Destination</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Sélectionner la ville de destination"
                          searchPlaceholder="Rechercher des villes..."
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
                    <FormLabel>Heure de Départ</FormLabel>
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
                              <span>Choisir une date et heure</span>
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
                              const [hours, minutes] =
                                e.target.value.split(":");
                              const newDate = new Date(
                                field.value || new Date()
                              );
                              newDate.setHours(parseInt(hours));
                              newDate.setMinutes(parseInt(minutes));
                              field.onChange(newDate);
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
                      <FormLabel>Prix (FCFA)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="ex: 5000"
                          onChange={(e) => onChange(Number(e.target.value))}
                          {...field}
                        />
                      </FormControl>
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
                    <FormLabel>Places Disponibles</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="ex: 4"
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          // Allow up to 10 seats maximum
                          onChange(Math.min(value, 10));
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre de places disponibles pour ce trajet
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
                      <FormLabel>Modèle de Voiture</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Toyota Camry" {...field} />
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
                      <FormLabel>Couleur de la Voiture</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Noir" {...field} />
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
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Création..." : "Créer le Trajet"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
