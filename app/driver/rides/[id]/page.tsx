"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRidesStore } from "@/stores";
import { Alert, AlertDescription, AlertTitle, Button } from "@/components/ui";
import { useToast } from "@/hooks/ui";
import { useCityPickupPoints, useLocale } from "@/hooks";
import { ApiError, bookingApiClient } from "@/lib/api-client";
import type { RidePickupPointInput } from "@/types";
import { ManageRideFormCard } from "./components/manage-ride-form-card";
import { RideBookingsCard } from "./components/ride-bookings-card";
import { NoShowDialog } from "./components/no-show-dialog";
import {
  ManageRideErrorState,
  ManageRideLoadingState,
  ManageRideNotFoundState,
} from "./components/manage-ride-page-states";
import type { RideDetails, RideFormValues } from "./types";

export default function ManageRidePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useSupabase();
  const { toast } = useToast();
  const { t } = useLocale();
  const {
    currentRide,
    currentRideLoading,
    currentRideError,
    fetchRideById,
    updateRide,
    deleteRide: deleteRideFromStore,
    cancelRide: cancelRideFromStore,
  } = useRidesStore();

  const ride = currentRide as RideDetails | null;
  const loading = currentRideLoading;
  const error = currentRideError;

  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasBookings, setHasBookings] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<RidePickupPointInput[]>([]);
  const [dropoffPointId, setDropoffPointId] = useState("");
  const [noShowDialogBookingId, setNoShowDialogBookingId] = useState<string | null>(
    null
  );
  const [noShowContactAttempted, setNoShowContactAttempted] = useState(false);
  const [noShowNote, setNoShowNote] = useState("");
  const [markingNoShowId, setMarkingNoShowId] = useState<string | null>(null);
  const lastPopulatedRideIdRef = useRef<string | null>(null);

  const totalBookedSeats =
    ride?.bookings?.reduce((sum: number, booking) => sum + (booking.seats ?? 0), 0) ??
    0;
  const paidBookedSeats =
    ride?.bookings
      ?.filter(
        (booking) =>
          booking.payment_status === "completed" ||
          booking.payment_status === "partial_refund"
      )
      .reduce((sum: number, booking) => sum + (booking.seats ?? 0), 0) ?? 0;
  const hasPaidBookings = paidBookedSeats > 0;
  const minSeatsAllowed = Math.max(1, totalBookedSeats, paidBookedSeats);
  const lockedPickupPointIds: string[] =
    hasPaidBookings && ride?.bookings
      ? [
          ...new Set(
            ride.bookings
              .filter(
                (booking) =>
                  booking.payment_status === "completed" ||
                  booking.payment_status === "partial_refund"
              )
              .map((booking) => booking.selected_pickup_point_id)
              .filter((id): id is string => Boolean(id))
          ),
        ]
      : [];
  const showLoading = loading || Boolean(params.id && !ride && !error);
  const isCancelFlow = hasBookings;
  const destructiveButtonLabel = isCancelFlow
    ? t("pages.driver.manageRide.form.cancelAndRefund")
    : t("pages.driver.manageRide.form.delete");
  const destructiveProgressLabel = isCancelFlow
    ? t("pages.driver.manageRide.form.cancellingAndRefunding")
    : t("pages.driver.manageRide.form.deleting");
  const destructiveConfirmTitle = isCancelFlow
    ? t("pages.driver.manageRide.alerts.cancelRideConfirm.title")
    : t("pages.driver.manageRide.alerts.deleteConfirm.title");
  const destructiveConfirmDescription = isCancelFlow
    ? t("pages.driver.manageRide.alerts.cancelRideConfirm.description")
    : t("pages.driver.manageRide.alerts.deleteConfirm.description");
  const destructiveConfirmActionLabel = isCancelFlow
    ? t("pages.driver.manageRide.alerts.cancelRideConfirm.confirm")
    : t("pages.driver.manageRide.alerts.deleteConfirm.confirm");

  const rideFormSchema = z.object({
    from_city: z.string().min(2, {
      message: t("pages.driver.manageRide.validation.fromCityMin"),
    }),
    to_city: z.string().min(2, {
      message: t("pages.driver.manageRide.validation.toCityMin"),
    }),
    dropoff_point_id: z.string().optional(),
    departure_date: z.string({
      required_error: t("pages.driver.manageRide.validation.departureDateRequired"),
    }),
    departure_time: z.string({
      required_error: t("pages.driver.manageRide.validation.departureTimeRequired"),
    }),
    price: z.string().refine(
      (value) => {
        const parsed = parseInt(value);
        return !isNaN(parsed) && parsed > 0 && parsed <= 6000;
      },
      { message: "Our price limit is 6000 FCFA per ride." }
    ),
    seats: z.string().refine(
      (value) => {
        const parsed = parseInt(value);
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
      dropoff_point_id: "",
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
  const toCity = form.watch("to_city");
  const { cityPickupPoints, loading: pickupPointsLoading } = useCityPickupPoints(
    fromCity ?? ""
  );
  const { cityPickupPoints: toCityDropoffPoints, loading: dropoffPointsLoading } =
    useCityPickupPoints(toCity ?? "");

  useEffect(() => {
    async function loadRide() {
      if (!user) {
        return;
      }

      try {
        await fetchRideById(params.id);
      } catch (loadError) {
        console.error("Error in loadRide:", loadError);
        toast({
          title: t("pages.driver.manageRide.errors.title"),
          description: t("pages.driver.manageRide.errors.loadError"),
          variant: "destructive",
        });
      }
    }

    loadRide();
  }, [params.id, user, fetchRideById, toast]);

  useEffect(() => {
    lastPopulatedRideIdRef.current = null;
  }, [params.id]);

  useEffect(() => {
    if (!loading && currentRide && !error) {
      if (currentRide.id === lastPopulatedRideIdRef.current) return;

      lastPopulatedRideIdRef.current = currentRide.id;
      setHasBookings(Boolean(currentRide.bookings && currentRide.bookings.length > 0));

      try {
        const departureDate = new Date(currentRide.departure_time);
        const points = currentRide.pickup_points;
        const initialPickupPoints: RidePickupPointInput[] = Array.isArray(points)
          ? points.map((point) => ({
              id: point.id,
              order: point.order,
              time_offset_minutes: point.time_offset_minutes,
            }))
          : [];

        setPickupPoints(initialPickupPoints);
        setDropoffPointId(currentRide.dropoff_point_id || "");
        form.reset({
          from_city: currentRide.from_city,
          to_city: currentRide.to_city,
          dropoff_point_id: currentRide.dropoff_point_id || "",
          departure_date: format(departureDate, "yyyy-MM-dd"),
          departure_time: format(departureDate, "HH:mm"),
          price: currentRide.price.toString(),
          seats: currentRide.seats_available.toString(),
          description: currentRide.description || "",
          pickup_points: initialPickupPoints,
        });
      } catch (formError) {
        console.error("Error populating form:", formError);
        toast({
          title: t("pages.driver.manageRide.errors.title"),
          description: t("pages.driver.manageRide.errors.formError"),
          variant: "destructive",
        });
      }
    }
  }, [loading, currentRide, error, params.id]);

  async function onSubmit(values: RideFormValues) {
    if (!user || !ride) return;

    try {
      setUpdating(true);

      const dateTimeString = `${values.departure_date}T${values.departure_time}:00`;
      const departureTime = new Date(dateTimeString).toISOString();

      const updateData: {
        from_city: string;
        to_city: string;
        dropoff_point_id?: string;
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

      if (values.dropoff_point_id && values.dropoff_point_id.trim() !== "") {
        updateData.dropoff_point_id = values.dropoff_point_id;
      }

      if (hasBookings) {
        const minSeats = Math.max(totalBookedSeats, paidBookedSeats);
        if (parseInt(values.seats) < minSeats) {
          toast({
            title: t("pages.driver.manageRide.alerts.cannotReduceSeats.title"),
            description: t(
              "pages.driver.manageRide.alerts.cannotReduceSeats.description",
              { count: minSeats.toString() }
            ),
            variant: "destructive",
          });
          setUpdating(false);
          return;
        }
      }

      const updateResult = await updateRide(ride.id, updateData);

      if (!updateResult) {
        console.error("Failed to update ride");
        throw new Error("Failed to update ride");
      }

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);

      toast({
        title: t("pages.driver.manageRide.toast.updated.title"),
        description: t("pages.driver.manageRide.toast.updated.description", {
          from: values.from_city,
          to: values.to_city,
          price: values.price,
          seats: values.seats,
        }),
      });
    } catch (submitError) {
      console.error("Error in update process:", submitError);
      toast({
        title: t("pages.driver.manageRide.errors.title"),
        description: t("pages.driver.manageRide.errors.updateError"),
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  }

  async function deleteRide() {
    if (!user || !ride) return;

    try {
      setDeleting(true);

      if (hasBookings) {
        await cancelRideFromStore(ride.id);
      } else {
        await deleteRideFromStore(ride.id);
      }

      toast(
        isCancelFlow
          ? {
              title: t("pages.driver.manageRide.toast.cancelled.title"),
              description: t("pages.driver.manageRide.toast.cancelled.description"),
            }
          : {
              title: t("pages.driver.manageRide.toast.deleted.title"),
              description: t("pages.driver.manageRide.toast.deleted.description"),
            }
      );

      router.push("/driver/dashboard");
    } catch (deleteError) {
      console.error("Error in delete process:", deleteError);
      toast({
        title: t("pages.driver.manageRide.errors.title"),
        description: t("pages.driver.manageRide.errors.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  function resetNoShowDialog() {
    setNoShowDialogBookingId(null);
    setNoShowContactAttempted(false);
    setNoShowNote("");
  }

  async function handleConfirmNoShow() {
    if (!ride || !noShowDialogBookingId) return;

    try {
      setMarkingNoShowId(noShowDialogBookingId);

      const response = await bookingApiClient.markBookingNoShow(noShowDialogBookingId, {
        contactAttempted: noShowContactAttempted,
        note: noShowNote.trim() || undefined,
      });

      if (!response.success) {
        throw new Error(response.error || "Unable to update this booking right now.");
      }

      toast({
        title: t("pages.driver.manageRide.bookings.noShowSuccessTitle"),
        description: t("pages.driver.manageRide.bookings.noShowSuccessDescription"),
      });

      resetNoShowDialog();
      await fetchRideById(ride.id);
    } catch (noShowError) {
      const message =
        noShowError instanceof ApiError
          ? noShowError.getDisplayMessage()
          : noShowError instanceof Error
          ? noShowError.message
          : "Unable to update this booking right now.";

      toast({
        title: t("pages.driver.manageRide.errors.title"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setMarkingNoShowId(null);
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
        <ManageRideLoadingState t={t} />
      ) : error ? (
        <ManageRideErrorState
          t={t}
          error={error}
          onBackToDashboard={() => router.push("/driver/dashboard")}
        />
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

          <ManageRideFormCard
            t={t}
            form={form}
            onSubmit={onSubmit}
            isDirty={isDirty}
            hasBookings={hasBookings}
            hasPaidBookings={hasPaidBookings}
            minSeatsAllowed={minSeatsAllowed}
            cityPickupPoints={cityPickupPoints}
            toCityDropoffPoints={toCityDropoffPoints}
            pickupPointsLoading={pickupPointsLoading}
            dropoffPointsLoading={dropoffPointsLoading}
            pickupPoints={pickupPoints}
            setPickupPoints={setPickupPoints}
            dropoffPointId={dropoffPointId}
            setDropoffPointId={setDropoffPointId}
            lockedPickupPointIds={lockedPickupPointIds}
            updating={updating}
            deleting={deleting}
            updateSuccess={updateSuccess}
            onDismissUpdateSuccess={() => setUpdateSuccess(false)}
            destructiveButtonLabel={destructiveButtonLabel}
            destructiveProgressLabel={destructiveProgressLabel}
            destructiveConfirmTitle={destructiveConfirmTitle}
            destructiveConfirmDescription={destructiveConfirmDescription}
            destructiveConfirmActionLabel={destructiveConfirmActionLabel}
            onDeleteRide={deleteRide}
          />

          <RideBookingsCard
            t={t}
            hasBookings={hasBookings}
            bookings={ride.bookings}
            markingNoShowId={markingNoShowId}
            onOpenNoShowDialog={(bookingId) => {
              setNoShowDialogBookingId(bookingId);
              setNoShowContactAttempted(false);
              setNoShowNote("");
            }}
            onViewBooking={(bookingId) => router.push(`/driver/bookings/${bookingId}`)}
          />
        </div>
      ) : (
        <ManageRideNotFoundState
          t={t}
          onBackToDashboard={() => router.push("/driver/dashboard")}
        />
      )}

      <NoShowDialog
        t={t}
        open={Boolean(noShowDialogBookingId)}
        markingNoShowId={markingNoShowId}
        noShowContactAttempted={noShowContactAttempted}
        noShowNote={noShowNote}
        setNoShowContactAttempted={setNoShowContactAttempted}
        setNoShowNote={setNoShowNote}
        onConfirm={handleConfirmNoShow}
        onCloseAndReset={resetNoShowDialog}
      />
    </div>
  );
}
