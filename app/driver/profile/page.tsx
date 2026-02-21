"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "@/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  AvatarUpload,
  SearchableSelect,
  Skeleton,
} from "@/components/ui";
import { Car, User } from "lucide-react";
import { allCameroonCities } from "@/app/data/cities";

const createDriverProfileSchema = (t: (key: string) => string) =>
  z.object({
    full_name: z
      .string()
      .min(2, t("pages.driver.profile.validation.fullNameMin")),
    email: z.string().email(t("pages.driver.profile.validation.emailInvalid")),
    phone: z
      .string()
      .min(10, t("pages.driver.profile.validation.phoneMin")),
    city: z.string().min(2, t("pages.driver.profile.validation.cityRequired")),
    vehicle_make: z
      .string()
      .min(1, t("pages.driver.profile.validation.vehicleMakeRequired")),
    vehicle_model: z
      .string()
      .min(1, t("pages.driver.profile.validation.vehicleModelRequired")),
    vehicle_year: z
      .string()
      .min(4, t("pages.driver.profile.validation.vehicleYearRequired")),
    vehicle_color: z
      .string()
      .min(1, t("pages.driver.profile.validation.vehicleColorRequired")),
  });

type DriverProfileValues = z.infer<ReturnType<typeof createDriverProfileSchema>>;

export default function DriverProfilePage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { t } = useLocale();
  const driverProfileSchema = createDriverProfileSchema(t);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const form = useForm<DriverProfileValues>({
    resolver: zodResolver(driverProfileSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      city: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_color: "",
    },
  });

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }

    const loadProfile = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*, driver_documents (*)")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (!profile.is_driver) {
          router.push("/become-driver");
          return;
        }

        // Set form values
        form.reset({
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          city: profile.city || "",
          vehicle_make: profile.driver_documents?.vehicle_make || "",
          vehicle_model: profile.driver_documents?.vehicle_model || "",
          vehicle_year: profile.driver_documents?.vehicle_year || "",
          vehicle_color: profile.driver_documents?.vehicle_color || "",
        });

        setAvatarUrl(profile.avatar_url);
      } catch (error) {
        console.error("Error loading profile:", error);
        toast({
          title: t("pages.driver.profile.toast.errorTitle"),
          description: t("pages.driver.profile.toast.loadError"),
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadProfile();
  }, [user, router, supabase, form, t]);

  const onSubmit = async (values: DriverProfileValues) => {
    try {
      setIsSaving(true);

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
        .eq("id", user!.id);

      if (profileError) throw profileError;

      // Update driver documents
      const { error: documentsError } = await supabase
        .from("driver_documents")
        .update({
          vehicle_make: values.vehicle_make,
          vehicle_model: values.vehicle_model,
          vehicle_year: values.vehicle_year,
          vehicle_color: values.vehicle_color,
          updated_at: new Date().toISOString(),
        })
        .eq("driver_id", user!.id);

      if (documentsError) throw documentsError;

      toast({
        title: t("pages.driver.profile.toast.updatedTitle"),
        description: t("pages.driver.profile.toast.updatedDescription"),
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: t("pages.driver.profile.toast.errorTitle"),
        description: t("pages.driver.profile.toast.updateError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="container max-w-4xl py-10">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>

        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Skeleton className="h-[150px] w-[150px] rounded-full" />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {t("pages.driver.profile.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("pages.driver.profile.description")}
        </p>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">
            {t("pages.driver.profile.tabs.personal")}
          </TabsTrigger>
          <TabsTrigger value="vehicle">
            {t("pages.driver.profile.tabs.vehicle")}
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t("pages.driver.profile.personal.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("pages.driver.profile.personal.description")}
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.fullName")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.email")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.phone")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.city")}
                          </FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={allCameroonCities}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder={t(
                                "pages.driver.profile.placeholders.selectCity"
                              )}
                              searchPlaceholder={t(
                                "pages.driver.profile.placeholders.searchCity"
                              )}
                            />
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
                    {t("pages.driver.profile.vehicle.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("pages.driver.profile.vehicle.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="vehicle_make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("pages.driver.profile.fields.vehicleMake")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.vehicleModel")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.vehicleYear")}
                          </FormLabel>
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
                          <FormLabel>
                            {t("pages.driver.profile.fields.vehicleColor")}
                          </FormLabel>
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
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? t("pages.driver.profile.actions.saving")
                  : t("pages.driver.profile.actions.save")}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}
