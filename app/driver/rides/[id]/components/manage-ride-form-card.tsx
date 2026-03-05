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
  SearchableSelect,
  Textarea,
} from "@/components/ui";
import { DropoffPointSelectForm, PickupPointsSelectForm } from "@/components";
import { allCameroonCities } from "@/app/data/cities";
import { Calendar, Check, Clock, Coins, Info, Save, Trash2, Users } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { CityPickupPoint, RidePickupPointInput } from "@/types";
import type { RideFormValues, TranslateFn } from "../types";

interface ManageRideFormCardProps {
  t: TranslateFn;
  form: UseFormReturn<RideFormValues>;
  onSubmit: (values: RideFormValues) => void | Promise<void>;
  isDirty: boolean;
  hasBookings: boolean;
  hasPaidBookings: boolean;
  minSeatsAllowed: number;
  cityPickupPoints: CityPickupPoint[];
  toCityDropoffPoints: CityPickupPoint[];
  pickupPointsLoading: boolean;
  dropoffPointsLoading: boolean;
  pickupPoints: RidePickupPointInput[];
  setPickupPoints: (points: RidePickupPointInput[]) => void;
  dropoffPointId: string;
  setDropoffPointId: (id: string) => void;
  lockedPickupPointIds: string[];
  updating: boolean;
  deleting: boolean;
  updateSuccess: boolean;
  onDismissUpdateSuccess: () => void;
  destructiveButtonLabel: string;
  destructiveProgressLabel: string;
  destructiveConfirmTitle: string;
  destructiveConfirmDescription: string;
  destructiveConfirmActionLabel: string;
  onDeleteRide: () => void | Promise<void>;
}

export function ManageRideFormCard({
  t,
  form,
  onSubmit,
  isDirty,
  hasBookings,
  hasPaidBookings,
  minSeatsAllowed,
  cityPickupPoints,
  toCityDropoffPoints,
  pickupPointsLoading,
  dropoffPointsLoading,
  pickupPoints,
  setPickupPoints,
  dropoffPointId,
  setDropoffPointId,
  lockedPickupPointIds,
  updating,
  deleting,
  updateSuccess,
  onDismissUpdateSuccess,
  destructiveButtonLabel,
  destructiveProgressLabel,
  destructiveConfirmTitle,
  destructiveConfirmDescription,
  destructiveConfirmActionLabel,
  onDeleteRide,
}: ManageRideFormCardProps) {
  return (
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
        <CardDescription>{t("pages.driver.manageRide.form.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        onValueChange={(value) => {
                          field.onChange(value);
                          setDropoffPointId("");
                          form.setValue("dropoff_point_id", "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
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
                name="dropoff_point_id"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DropoffPointSelectForm
                        cityDropoffPoints={toCityDropoffPoints}
                        value={dropoffPointId}
                        onChange={(selectedId) => {
                          setDropoffPointId(selectedId);
                          field.onChange(selectedId);
                        }}
                        error={form.formState.errors.dropoff_point_id?.message}
                        loading={dropoffPointsLoading}
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
                        {t("pages.driver.manageRide.form.seatsDescription")} Minimum:{" "}
                        {minSeatsAllowed}
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
                      lockedPickupPointIds={
                        hasPaidBookings ? lockedPickupPointIds : undefined
                      }
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
                    disabled={updating}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {destructiveButtonLabel}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{destructiveConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {destructiveConfirmDescription}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t("pages.driver.manageRide.alerts.deleteConfirm.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteRide}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {deleting
                        ? destructiveProgressLabel
                        : destructiveConfirmActionLabel}
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
              onClick={onDismissUpdateSuccess}
              className="text-green-700 border-green-300 hover:bg-green-100"
            >
              {t("pages.driver.manageRide.toast.updateSuccess.close")}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
