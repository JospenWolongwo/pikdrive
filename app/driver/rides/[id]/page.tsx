"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore } from "@/stores";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { allCameroonCities } from "@/app/data/cities";
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  Coins,
  Users,
  Info,
  Trash2,
  Save,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { format, addDays, parse } from "date-fns";
import { fr } from "date-fns/locale";

// Define the form schema with validation rules
const rideFormSchema = z.object({
  from_city: z.string().min(2, {
    message: "La ville de départ doit contenir au moins 2 caractères",
  }),
  to_city: z.string().min(2, {
    message: "La ville d'arrivée doit contenir au moins 2 caractères",
  }),
  departure_date: z.string({
    required_error: "La date de départ est requise",
  }),
  departure_time: z.string({
    required_error: "L'heure de départ est requise",
  }),
  price: z.string().refine(
    (val) => {
      const parsed = parseInt(val);
      return !isNaN(parsed) && parsed > 0;
    },
    {
      message: "Le prix doit être un nombre positif",
    }
  ),
  seats: z.string().refine(
    (val) => {
      const parsed = parseInt(val);
      return !isNaN(parsed) && parsed > 0 && parsed <= 8;
    },
    {
      message: "Le nombre de places doit être entre 1 et 8",
    }
  ),
  description: z.string().optional(),
});

// Type for the form values
type RideFormValues = z.infer<typeof rideFormSchema>;

// Interface for Ride type
interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  price: number;
  seats_available: number;
  description?: string;
  car_model?: string;
  car_color?: string;
  driver_id: string;
  bookings?: {
    id: string;
    status: string;
    user_id: string;
  }[];
}

export default function ManageRidePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const { currentRide, currentRideLoading, currentRideError, fetchRideById, updateRide, deleteRide: deleteRideFromStore } = useRidesStore();
  const ride = currentRide;
  const loading = currentRideLoading;
  const error = currentRideError;
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasBookings, setHasBookings] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Form initialization with default empty values
  const form = useForm<RideFormValues>({
    resolver: zodResolver(rideFormSchema),
    defaultValues: {
      from_city: "",
      to_city: "",
      departure_date: "",
      departure_time: "",
      price: "",
      seats: "",
      description: "",
    },
  });

  // Load ride data when component mounts
  useEffect(() => {
    async function loadRide() {
      if (!user) return;

      try {
        // Use Zustand store to fetch ride
        await fetchRideById(params.id);
        
        // Check if there are any bookings at all
        if (currentRide) {
          setHasBookings(currentRide.bookings && currentRide.bookings.length > 0);
        }

        // Parse departure time and set form values
        if (currentRide) {
          const departureDate = new Date(currentRide.departure_time);

          form.reset({
            from_city: currentRide.from_city,
            to_city: currentRide.to_city,
            departure_date: format(departureDate, "yyyy-MM-dd"),
            departure_time: format(departureDate, "HH:mm"),
            price: currentRide.price.toString(),
            seats: currentRide.seats_available.toString(),
            description: currentRide.description || "",
          });
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors du chargement du trajet",
          variant: "destructive",
        });
      }
    }

    loadRide();
  }, [params.id, user, router, toast, form, fetchRideById, currentRide]);

  // Function to update ride details
  async function onSubmit(values: RideFormValues) {
    if (!user || !ride) return;

    try {
      setUpdating(true);
      console.log("🔄 Updating ride with values:", values);

      // Combine date and time into ISO string
      const dateTimeString = `${values.departure_date}T${values.departure_time}:00`;
      const departureTime = new Date(dateTimeString).toISOString();

     

      // Prepare update data with all required fields
      const updateData: {
        from_city: string;
        to_city: string;
        departure_time: string;
        price: number;
        description?: string;
        seats_available: number;
      } = {
        from_city: values.from_city,
        to_city: values.to_city,
        departure_time: departureTime,
        price: parseInt(values.price),
        description: values.description,
        seats_available: parseInt(values.seats),
      };

      // If there are existing bookings, we shouldn't reduce seats below that number
      if (hasBookings) {
        const bookedSeats = ride.bookings?.length || 0;
        if (parseInt(values.seats) < bookedSeats) {
          toast({
            title: "Impossible de réduire les places",
            description: `Vous avez déjà ${bookedSeats} réservation(s). Vous ne pouvez pas réduire le nombre de places disponibles en dessous de ce nombre.`,
            variant: "destructive",
          });
          setUpdating(false);
          return;
        }
      }

      // Update the ride using Zustand store
      console.log("🔄 Sending update data to database:", updateData);

      const updateResult = await updateRide(ride.id, updateData);

      console.log("🔄 Update response details:");
      console.log("  - Data:", updateResult);

      // The updateRide function from Zustand store returns the updated ride
      if (!updateResult) {
        console.error("❌ Failed to update ride");
        throw new Error("Failed to update ride");
      }

      console.log("✅ Ride updated successfully:", updateResult);




      // Show success state briefly
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);

      toast({
        title: "Trajet mis à jour avec succès",
        description: `Trajet de ${values.from_city} vers ${values.to_city} mis à jour. Prix: ${values.price} FCFA, Places: ${values.seats}`,
      });
    } catch (error) {
      console.error("❌ Error in update process:", error);
      toast({
        title: "Erreur",
        description:
          "Impossible de mettre à jour le trajet. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  }

  // Function to delete ride
  async function deleteRide() {
    if (!user || !ride) return;

    try {
      setDeleting(true);
      console.log(`🗑️ Deleting ride: ${ride.id}`);

      // Check if the ride has active bookings
      if (hasBookings) {
        toast({
          title: "Suppression impossible",
          description:
            "Vous ne pouvez pas supprimer un trajet avec des réservations actives.",
          variant: "destructive",
        });
        setDeleting(false);
        return;
      }

      // Delete the ride using Zustand store
      await deleteRideFromStore(ride.id);

      console.log("✅ Ride deleted successfully");
      toast({
        title: "Trajet supprimé",
        description: "Le trajet a été supprimé avec succès",
      });

      // Redirect back to dashboard
      router.push("/driver/dashboard");
    } catch (error) {
      console.error("❌ Error in delete process:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le trajet. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-6 flex items-center gap-2"
        onClick={() => router.push("/driver/dashboard")}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au tableau de bord
      </Button>

      <h1 className="text-2xl font-bold mb-6">Gérer le Trajet</h1>

      {loading ? (
        <div className="text-center py-12">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-current border-r-transparent"
            role="status"
          >
            <span className="sr-only">Chargement...</span>
          </div>
          <p className="mt-4 text-gray-500">
            Chargement des détails du trajet...
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <Button
            className="mt-4"
            onClick={() => router.push("/driver/dashboard")}
          >
            Retour au tableau de bord
          </Button>
        </div>
      ) : ride ? (
        <div className="space-y-6">
          {hasBookings && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Réservations actives</AlertTitle>
              <AlertDescription>
                Ce trajet a des réservations actives. Certaines modifications
                peuvent être limitées.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Détails du Trajet
                {updateSuccess && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                    <Check className="h-3 w-3" />
                    Mis à jour
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Modifiez les informations de votre trajet ci-dessous
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="from_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville de départ</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={allCameroonCities}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Sélectionnez une ville de départ"
                              searchPlaceholder="Rechercher une ville..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="to_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville d'arrivée</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={allCameroonCities}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Sélectionnez une ville d'arrivée"
                              searchPlaceholder="Rechercher une ville..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departure_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de départ</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="date"
                                {...field}
                                min="2024-01-01"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departure_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heure de départ</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input className="pl-10" type="time" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix par place (FCFA)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Coins className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="number"
                                min="1"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de places</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="number"
                                min="1"
                                max="8"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          {hasBookings && (
                            <FormDescription>
                              Places disponibles pour ce trajet
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (facultatif)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Info className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Textarea
                              className="pl-10 min-h-[100px]"
                              placeholder="Informations supplémentaires sur le trajet..."
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Ajoutez des détails comme les arrêts prévus, les
                          règles spécifiques, etc.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={updating || hasBookings}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer le trajet
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Êtes-vous sûr de vouloir supprimer ce trajet ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible et supprimera
                            définitivement ce trajet.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={deleteRide}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            {deleting ? "Suppression..." : "Supprimer"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button type="submit" disabled={updating}>
                      <Save className="h-4 w-4 mr-2" />
                      {updating
                        ? "Enregistrement..."
                        : "Enregistrer les modifications"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>

            {updateSuccess && (
              <CardFooter className="bg-green-50 border-green-200">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Trajet mis à jour avec succès ! Les modifications ont été
                      enregistrées.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUpdateSuccess(false)}
                    className="text-green-700 border-green-300 hover:bg-green-100"
                  >
                    Fermer
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>

          {hasBookings && (
            <Card>
              <CardHeader>
                <CardTitle>Réservations</CardTitle>
                <CardDescription>
                  Voici les réservations actuelles pour ce trajet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ride.bookings?.map((booking) => (
                    <div key={booking.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            Réservation #{booking.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Statut: {booking.status}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/driver/bookings/${booking.id}`)
                          }
                        >
                          Voir détails
                        </Button>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-4">
                      Aucune réservation trouvée
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-gray-500">
            Trajet introuvable ou inaccessible
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/driver/dashboard")}
          >
            Retour au tableau de bord
          </Button>
        </div>
      )}
    </div>
  );
}
