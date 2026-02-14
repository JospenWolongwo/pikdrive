"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";

import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore } from "@/stores";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelect,
} from "@/components/ui";
import { useToast } from "@/hooks/ui";
import { PickupPointsSelectForm } from "@/components";
import { useLocale, useCityPickupPoints, useNotificationPromptTrigger } from "@/hooks";
import { ridesApiClient, ApiError } from "@/lib/api-client";
import { cn, getCurrentTimeUTC, dateToUTCDate } from "@/lib/utils";
import { allCameroonCities } from "@/app/data/cities";
import type { CityPickupPoint, RidePickupPointInput, Ride, RideWithDetails } from "@/types";

const createFormSchema = (t: (key: string) => string) => z.object({
  fromCity: z.string().min(1, t("pages.driver.newRide.validation.fromCityRequired")),
  toCity: z.string().min(1, t("pages.driver.newRide.validation.toCityRequired")),
  departureTime: z.date({
    required_error: t("pages.driver.newRide.validation.departureTimeRequired"),
  }),
  price: z.number().min(1, t("pages.driver.newRide.validation.priceRequired")).optional(),
  seatsAvailable: z
    .number()
    .min(1, t("pages.driver.newRide.validation.seatsRequired"))
    .max(100, t("pages.driver.newRide.validation.seatsMax"))
    .optional(),
  carModel: z.string().min(1, t("pages.driver.newRide.validation.carModelRequired")),
  carColor: z.string().min(1, t("pages.driver.newRide.validation.carColorRequired")),
  pickupPoints: z.array(z.object({
    id: z.string(),
    order: z.number(),
    time_offset_minutes: z.number().min(0),
  })).min(1, t("pages.driver.newRide.validation.pickupPointsMinRequired")),
});

export default function NewRidePage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const { t } = useLocale();
  
  const formSchema = createFormSchema(t);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [createdRide, setCreatedRide] = useState<{ fromCity: string; toCity: string } | null>(null);
  const { refreshDriverRides, addDriverRide } = useRidesStore();
  const { triggerPrompt } = useNotificationPromptTrigger();

  // Create a sorted list of all cities
  const allCities = allCameroonCities.sort();

  const form = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromCity: "",
      toCity: "",
      price: undefined,
      seatsAvailable: undefined,
      carModel: "",
      carColor: "",
      pickupPoints: [],
    },
  });

  const [pickupPoints, setPickupPoints] = useState<RidePickupPointInput[]>([]);
  const fromCity = form.watch("fromCity");
  const { cityPickupPoints, loading: pickupPointsLoading } =
    useCityPickupPoints(fromCity ?? "");

  useEffect(() => {
    if (!fromCity?.trim()) return;
    setPickupPoints([]);
    form.setValue("pickupPoints", []);
  }, [fromCity, form]);

  async function onSubmit(values: z.infer<ReturnType<typeof createFormSchema>>) {
    if (!user) {
      toast({
        title: t("pages.driver.newRide.errors.authRequired"),
        description: t("pages.driver.newRide.errors.authRequiredDescription"),
        variant: "destructive",
      });
      router.push("/auth");
      return;
    }

    // Validate that required numeric fields are provided
    if (!values.price || !values.seatsAvailable) {
      toast({
        title: t("pages.driver.newRide.errors.fieldsRequired"),
        description: t("pages.driver.newRide.errors.fieldsRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const nowUTC = getCurrentTimeUTC();
      const departureUTC = dateToUTCDate(values.departureTime);

      // Ensure the departure time is in the future
      if (departureUTC.getTime() <= nowUTC.getTime()) {
        toast({
          title: t("pages.driver.newRide.invalidTime"),
          description: t("pages.driver.newRide.invalidTimeDescription"),
          variant: "destructive",
        });
        return;
      }

      if (!pickupPoints || pickupPoints.length < 1) {
        toast({
          title: t("pages.driver.newRide.errors.pickupPointsRequired"),
          description: t("pages.driver.newRide.errors.pickupPointsRequiredDescription"),
          variant: "destructive",
        });
        return;
      }

      const validPickupPoints = pickupPoints.filter(
        (p) => typeof p.time_offset_minutes === "number" && p.time_offset_minutes >= 0
      );
      if (validPickupPoints.length < 1) {
        toast({
          title: t("pages.driver.newRide.errors.pickupPointsInvalid"),
          description: t("pages.driver.newRide.errors.pickupPointsInvalidDescription"),
          variant: "destructive",
        });
        return;
      }

      const result = await ridesApiClient.createRide({
        from_city: values.fromCity,
        to_city: values.toCity,
        departure_time: departureUTC.toISOString(),
        price: values.price,
        seats_available: values.seatsAvailable,
        car_model: values.carModel,
        car_color: values.carColor,
        pickup_points: validPickupPoints.map(({ id, order, time_offset_minutes }) => ({
          id,
          order,
          time_offset_minutes,
        })),
      });

      if (!result.success) {
        console.error("Error creating ride:", result);
        throw new Error(result.error || "Failed to create ride");
      }

      if (!result.data) {
        throw new Error("Failed to create ride");
      }

      //  OPTIMISTIC UPDATE: Add ride to store immediately (no API call needed!)
      const newRide: RideWithDetails = {
        ...(result.data as Ride),
        bookings: [],
        messages: [],
      };
      addDriverRide(newRide);

      setCreatedRide({
        fromCity: values.fromCity,
        toCity: values.toCity,
      });

      setShowSuccessDialog(true);

      // Trigger notification prompt after ride creation
      // This is a critical moment - driver is actively using the platform
      // Use priority=true to bypass 24h cooldown for critical ride creation events
      triggerPrompt(true);
    } catch (error) {
      console.error("Error creating ride:", error);
      toast({
        title: t("pages.driver.newRide.errors.error"),
        description: error instanceof ApiError
          ? error.getDisplayMessage()
          : t("pages.driver.newRide.errors.errorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGoToDashboard = async () => {
    setIsRedirecting(true);
    setShowSuccessDialog(false);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
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
              <DialogTitle className="text-2xl">{t("pages.driver.newRide.successTitle")}</DialogTitle>
              <DialogDescription className="text-base">
                {createdRide && (
                  <>
                    {t("pages.driver.newRide.successDescription")}
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
                  {t("pages.driver.newRide.redirecting")}
                </>
              ) : (
                t("pages.driver.newRide.goToDashboard")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("pages.driver.newRide.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("pages.driver.newRide.description")}
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
                      <FormLabel>{t("pages.driver.newRide.fromCity")}</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t("pages.driver.newRide.fromCityPlaceholder")}
                          searchPlaceholder={t("pages.rides.filters.fromSearch")}
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
                      <FormLabel>{t("pages.driver.newRide.toCity")}</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={allCities}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t("pages.driver.newRide.toCityPlaceholder")}
                          searchPlaceholder={t("pages.rides.filters.toSearch")}
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
                    <FormLabel>{t("pages.driver.newRide.departureTime")}</FormLabel>
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
                              <span>{t("pages.driver.newRide.departureTimePlaceholder")}</span>
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

              <FormField
                control={form.control}
                name="pickupPoints"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PickupPointsSelectForm
                        cityPickupPoints={cityPickupPoints}
                        departureTime={form.watch("departureTime")}
                        value={pickupPoints}
                        onChange={(points) => {
                          setPickupPoints(points);
                          field.onChange(points);
                        }}
                        error={form.formState.errors.pickupPoints?.message}
                        loading={pickupPointsLoading}
                      />
                    </FormControl>
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
                      <FormLabel>{t("pages.driver.newRide.price")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t("pages.driver.newRide.pricePlaceholder")}
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
                    <FormLabel>{t("pages.driver.newRide.seatsAvailable")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t("pages.driver.newRide.seatsPlaceholder")}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          // Allow up to 10 seats maximum
                          onChange(Math.min(value, 10));
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("pages.driver.newRide.seatsDescription")}
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
                      <FormLabel>{t("pages.driver.newRide.carModel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("pages.driver.newRide.carModelPlaceholder")} {...field} />
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
                      <FormLabel>{t("pages.driver.newRide.carColor")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("pages.driver.newRide.carColorPlaceholder")} {...field} />
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
                  {t("pages.driver.newRide.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("pages.driver.newRide.creating") : t("pages.driver.newRide.create")}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
    </>
  );
}
