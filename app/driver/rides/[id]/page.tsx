"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore } from "@/stores";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  SearchableSelect,
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui";
import { useToast } from "@/hooks/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { format, addDays, parse } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale, useCityPickupPoints } from "@/hooks";
import { PickupPointsSelectForm } from "@/components/driver";
import type { CityPickupPoint, RidePickupPointInput } from "@/types";

type RideFormValues = {
  from_city: string;
  to_city: string;
  departure_date: string;
  departure_time: string;
  price: string;
  seats: string;
  description?: string;
  pickup_points?: RidePickupPointInput[];
};

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
  pickup_points?: { id: string; name?: string; order: number; time_offset_minutes: number }[];
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
  const { t, locale } = useLocale();
  const { currentRide, currentRideLoading, currentRideError, fetchRideById, updateRide, deleteRide: deleteRideFromStore } = useRidesStore();
  const ride = currentRide;
  const loading = currentRideLoading;
  const error = currentRideError;
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasBookings, setHasBookings] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<RidePickupPointInput[]>([]);
  const lastPopulatedRideIdRef = useRef<string | null>(null);

  const totalBookedSeats =
    ride?.bookings?.reduce((sum: number, b: any) => sum + (b.seats ?? 0), 0) ?? 0;
  const paidBookedSeats =
    ride?.bookings
      ?.filter((b: any) => b.payment_status === "completed")
      .reduce((sum: number, b: any) => sum + (b.seats ?? 0), 0) ?? 0;
  const hasPaidBookings = paidBookedSeats > 0;
  const minSeatsAllowed = Math.max(1, totalBookedSeats, paidBookedSeats);
  const lockedPickupPointIds =
    hasPaidBookings && ride?.bookings
      ? [...new Set(
          ride.bookings
            .filter((b) => b.payment_status === "completed")
            .map((b) => b.selected_pickup_point_id)
            .filter((id): id is string => Boolean(id))
        )]
      : [];
  const showLoading =
    loading || Boolean(params.id && !ride && !error);

  const rideFormSchema = z.object({
    from_city: z.string().min(2, {
      message: t("pages.driver.manageRide.validation.fromCityMin"),
    }),
    to_city: z.string().min(2, {
      message: t("pages.driver.manageRide.validation.toCityMin"),
    }),
    departure_date: z.string({
      required_error: t("pages.driver.manageRide.validation.departureDateRequired"),
    }),
    departure_time: z.string({
      required_error: t("pages.driver.manageRide.validation.departureTimeRequired"),
    }),
    price: z.string().refine(
      (val) => {
        const parsed = parseInt(val);
        return !isNaN(parsed) && parsed > 0;
      },
      { message: t("pages.driver.manageRide.validation.pricePositive") }
    ),
    seats: z.string().refine(
      (val) => {
        const parsed = parseInt(val);
        return !isNaN(parsed) && parsed > 0 && parsed <= 8;
      },
      { message: t("pages.driver.manageRide.validation.seatsRange") }
    ),
    description: z.string().optional(),
    pickup_points: z
      .array(
        z.object({
          id: z.string(),
          order: z.number(),
          time_offset_minutes: z.number().min(0),
        })
      )
      .min(1, t("pages.driver.newRide.validation.pickupPointsMinRequired")),
  });

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
      pickup_points: [],
    },
  });

  const { isDirty } = form.formState;
  const fromCity = form.watch("from_city");
  const { cityPickupPoints, loading: pickupPointsLoading } =
    useCityPickupPoints(fromCity ?? "");

  // Load ride data when component mounts (only once)
  useEffect(() => {
    async function loadRide() {
      if (!user) {
        return;
      }

      try {
        // Use Zustand store to fetch ride
        await fetchRideById(params.id);
      } catch (error) {
        console.error("❌ Error in loadRide:", error);
        toast({
          title: t("pages.driver.manageRide.errors.title"),
          description: t("pages.driver.manageRide.errors.loadError"),
          variant: "destructive",
        });
      }
    }

    loadRide();
    // Only depend on params.id and user - NOT currentRide to avoid infinite loop
  }, [params.id, user, fetchRideById, toast]);

  // Clear populated ref when navigating to a different ride
  useEffect(() => {
    lastPopulatedRideIdRef.current = null;
  }, [params.id]);

  // Populate form only once per ride load to avoid unnecessary resets
  useEffect(() => {
    if (!loading && currentRide && !error) {
      if (currentRide.id === lastPopulatedRideIdRef.current) return;

      lastPopulatedRideIdRef.current = currentRide.id;
      setHasBookings(
        Boolean(currentRide.bookings && currentRide.bookings.length > 0)
      );

      try {
        const departureDate = new Date(currentRide.departure_time);
        const pp = currentRide.pickup_points;
        const initialPickupPoints: RidePickupPointInput[] = Array.isArray(pp)
          ? pp.map((p) => ({
              id: p.id,
              order: p.order,
              time_offset_minutes: p.time_offset_minutes,
            }))
          : [];
        setPickupPoints(initialPickupPoints);
        form.reset({
          from_city: currentRide.from_city,
          to_city: currentRide.to_city,
          departure_date: format(departureDate, "yyyy-MM-dd"),
          departure_time: format(departureDate, "HH:mm"),
          price: currentRide.price.toString(),
          seats: currentRide.seats_available.toString(),
          description: currentRide.description || "",
          pickup_points: initialPickupPoints,
        });
      } catch (formError) {
        console.error("❌ Error populating form:", formError);
        toast({
          title: t("pages.driver.manageRide.errors.title"),
          description: t("pages.driver.manageRide.errors.formError"),
          variant: "destructive",
        });
      }
    }
  }, [loading, currentRide, error, params.id]);

  // Function to update ride details
  async function onSubmit(values: RideFormValues) {
    if (!user || !ride) return;

    try {
      setUpdating(true);

      // Combine date and time into ISO string
      const dateTimeString = `${values.departure_date}T${values.departure_time}:00`;
      const departureTime = new Date(dateTimeString).toISOString();

     

      const updateData: {
        from_city: string;
        to_city: string;
        departure_time: string;
        price: number;
        description?: string;
        seats_available: number;
        pickup_points: RidePickupPointInput[];
      } = {
        from_city: values.from_city,
        to_city: values.to_city,
        departure_time: departureTime,
        price: parseInt(values.price),
        description: values.description,
        seats_available: parseInt(values.seats),
        pickup_points: pickupPoints.map(({ id, order, time_offset_minutes }) => ({
          id,
          order,
          time_offset_minutes,
        })),
      };

      // If there are existing bookings, we shouldn't reduce seats below already booked seats
      if (hasBookings) {
        const minSeats = Math.max(totalBookedSeats, paidBookedSeats);
        if (parseInt(values.seats) < minSeats) {
          toast({
            title: t("pages.driver.manageRide.alerts.cannotReduceSeats.title"),
            description: t("pages.driver.manageRide.alerts.cannotReduceSeats.description", { count: minSeats.toString() }),
            variant: "destructive",
          });
          setUpdating(false);
          return;
        }
      }

      // Update the ride using Zustand store
      const updateResult = await updateRide(ride.id, updateData);

      // The updateRide function from Zustand store returns the updated ride
      if (!updateResult) {
        console.error("❌ Failed to update ride");
        throw new Error("Failed to update ride");
      }





      // Show success state briefly
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);

      toast({
        title: t("pages.driver.manageRide.toast.updated.title"),
        description: t("pages.driver.manageRide.toast.updated.description", { from: values.from_city, to: values.to_city, price: values.price, seats: values.seats }),
      });
    } catch (error) {
      console.error("❌ Error in update process:", error);
      toast({
        title: t("pages.driver.manageRide.errors.title"),
        description: t("pages.driver.manageRide.errors.updateError"),
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

      // Check if the ride has active bookings
      if (hasBookings) {
        toast({
          title: t("pages.driver.manageRide.alerts.cannotDelete.title"),
          description: t("pages.driver.manageRide.alerts.cannotDelete.description"),
          variant: "destructive",
        });
        setDeleting(false);
        return;
      }

      // Delete the ride using Zustand store
      await deleteRideFromStore(ride.id);

      toast({
        title: t("pages.driver.manageRide.toast.deleted.title"),
        description: t("pages.driver.manageRide.toast.deleted.description"),
      });

      // Redirect back to dashboard
      router.push("/driver/dashboard");
    } catch (error) {
      console.error("❌ Error in delete process:", error);
      toast({
        title: t("pages.driver.manageRide.errors.title"),
        description: t("pages.driver.manageRide.errors.deleteError"),
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
        {t("pages.driver.manageRide.backToDashboard")}
      </Button>

      <h1 className="text-2xl font-bold mb-6">{t("pages.driver.manageRide.title")}</h1>

      {showLoading ? (
        <div className="text-center py-12">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-current border-r-transparent"
            role="status"
          >
            <span className="sr-only">{t("pages.driver.manageRide.loading.text")}</span>
          </div>
          <p className="mt-4 text-gray-500">
            {t("pages.driver.manageRide.loading.description")}
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("pages.driver.manageRide.errors.title")}</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <Button
            className="mt-4"
            onClick={() => router.push("/driver/dashboard")}
          >
            {t("pages.driver.manageRide.backToDashboard")}
          </Button>
        </div>
      ) : !showLoading && ride ? (
        <div className="space-y-6">
          {hasBookings && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("pages.driver.manageRide.alerts.activeBookings.title")}</AlertTitle>
              <AlertDescription>
                {t("pages.driver.manageRide.alerts.activeBookings.description")}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t("pages.driver.manageRide.form.title")}
                {updateSuccess && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                    <Check className="h-3 w-3" />
                    {t("pages.driver.manageRide.toast.updateSuccess.text")}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {t("pages.driver.manageRide.form.description")}
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
                          <FormLabel>{t("pages.driver.manageRide.form.fromCity")}</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={allCameroonCities}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder={t("pages.driver.manageRide.form.fromCity")}
                              searchPlaceholder={t("common.search")}
                              disabled={hasBookings}
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
                          <FormLabel>{t("pages.driver.manageRide.form.toCity")}</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={allCameroonCities}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder={t("pages.driver.manageRide.form.toCity")}
                              searchPlaceholder={t("common.search")}
                              disabled={hasBookings}
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
                          <FormLabel>{t("pages.driver.manageRide.form.departureDate")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="date"
                                {...field}
                                min="2024-01-01"
                                disabled={hasBookings}
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
                          <FormLabel>{t("pages.driver.manageRide.form.departureTime")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="time"
                                {...field}
                                disabled={hasBookings}
                              />
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
                          <FormLabel>{t("pages.driver.manageRide.form.price")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Coins className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="number"
                                min="1"
                                {...field}
                                disabled={hasPaidBookings}
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
                          <FormLabel>{t("pages.driver.manageRide.form.seats")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                className="pl-10"
                                type="number"
                                min={minSeatsAllowed}
                                max="8"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          {hasBookings && (
                            <FormDescription>
                              {t("pages.driver.manageRide.form.seatsDescription")} Minimum: {minSeatsAllowed}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="pickup_points"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PickupPointsSelectForm
                            cityPickupPoints={cityPickupPoints}
                            departureTime={(() => {
                              const d = form.watch("departure_date");
                              const tm = form.watch("departure_time");
                              if (!d || !tm) return null;
                              return new Date(`${d}T${tm}`);
                            })()}
                            value={pickupPoints}
                            onChange={(points) => {
                              setPickupPoints(points);
                              field.onChange(points);
                            }}
                            error={form.formState.errors.pickup_points?.message}
                            loading={pickupPointsLoading}
                            lockedPickupPointIds={hasPaidBookings ? lockedPickupPointIds : undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("pages.driver.manageRide.form.description")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Info className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Textarea
                              className="pl-10 min-h-[100px]"
                              placeholder={t("pages.driver.manageRide.form.descriptionPlaceholder")}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          {t("pages.driver.manageRide.form.descriptionHelp")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={updating || hasBookings}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("pages.driver.manageRide.form.delete")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("pages.driver.manageRide.alerts.deleteConfirm.title")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("pages.driver.manageRide.alerts.deleteConfirm.description")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("pages.driver.manageRide.alerts.deleteConfirm.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={deleteRide}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            {deleting ? t("pages.driver.manageRide.form.deleting") : t("pages.driver.manageRide.alerts.deleteConfirm.confirm")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button
                      type="submit"
                      disabled={updating || !isDirty}
                      className="w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updating
                        ? t("pages.driver.manageRide.form.saving")
                        : t("pages.driver.manageRide.form.save")}
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
                      {t("pages.driver.manageRide.toast.updateSuccess.text")}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUpdateSuccess(false)}
                    className="text-green-700 border-green-300 hover:bg-green-100"
                  >
                    {t("pages.driver.manageRide.toast.updateSuccess.close")}
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>

          {hasBookings && (
            <Card>
              <CardHeader>
                <CardTitle>{t("pages.driver.manageRide.bookings.title")}</CardTitle>
                <CardDescription>
                  {t("pages.driver.manageRide.bookings.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ride.bookings?.map((booking) => (
                    <div key={booking.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            {t("pages.driver.manageRide.bookings.bookingId", { id: booking.id.slice(0, 8) })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {t("pages.driver.manageRide.bookings.status", { status: booking.status })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/driver/bookings/${booking.id}`)
                          }
                        >
                          {t("pages.driver.manageRide.bookings.viewDetails")}
                        </Button>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-4">
                      {t("pages.driver.manageRide.bookings.noBookings")}
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
            {t("pages.driver.manageRide.errors.notFound")}
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/driver/dashboard")}
          >
            {t("pages.driver.manageRide.backToDashboard")}
          </Button>
        </div>
      )}
    </div>
  );
}
