"use client";

import { useState, useEffect } from "react";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Loader2, Upload, X, ArrowRight, User } from "lucide-react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { toast } from "sonner";
import { useLocale } from "@/hooks";
import { CACHE_CONTROL_IMMUTABLE } from "@/lib/storage";

interface BookingPassengerInfoStepProps {
  onComplete: (data: { fullName: string; idRecto: string; idVerso: string }) => void;
  onClose: () => void;
  initialName?: string;
  isBusy?: boolean;
}

export function BookingPassengerInfoStep({
  onComplete,
  onClose,
  initialName = "",
  isBusy = false,
}: BookingPassengerInfoStepProps) {
  const { supabase, user } = useSupabase();
  const { t } = useLocale();
  const [fullName, setFullName] = useState(initialName);

  // Update fullName when initialName prop changes (only if field is empty to respect user input)
  useEffect(() => {
    if (initialName && !fullName) {
      setFullName(initialName);
    }
  }, [initialName, fullName]);
  const [idRectoFile, setIdRectoFile] = useState<File | null>(null);
  const [idVersoFile, setIdVersoFile] = useState<File | null>(null);
  const [idRectoPreview, setIdRectoPreview] = useState<string | null>(null);
  const [idVersoPreview, setIdVersoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (
    file: File,
    setFile: (file: File | null) => void,
    setPreview: (preview: string | null) => void
  ) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("pages.rides.booking.passengerInfo.errors.selectImage"));
      return;
    }

    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadDocument = async (file: File, userId: string, type: "recto" | "verso"): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/passenger-id-${type}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from("passenger-documents")
      .upload(filePath, file, {
        cacheControl: CACHE_CONTROL_IMMUTABLE,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`${t("pages.rides.booking.passengerInfo.errors.uploadError")}: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from("passenger-documents")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error(t("pages.rides.booking.passengerInfo.errors.enterName"));
      return;
    }

    if (!idRectoFile || !idVersoFile) {
      toast.error(t("pages.rides.booking.passengerInfo.errors.uploadBoth"));
      return;
    }

    if (!user) {
      toast.error(t("pages.rides.booking.passengerInfo.errors.mustBeLoggedIn"));
      return;
    }

    try {
      setSubmitting(true);

      // Upload both documents
      const [idRectoUrl, idVersoUrl] = await Promise.all([
        uploadDocument(idRectoFile, user.id, "recto"),
        uploadDocument(idVersoFile, user.id, "verso"),
      ]);

      // Save to database
      const { error: dbError } = await supabase
        .from("passenger_documents")
        .upsert({
          user_id: user.id,
          full_name: fullName.trim(),
          national_id_file_recto: idRectoUrl,
          national_id_file_verso: idVersoUrl,
          updated_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      // Update profile.full_name ONLY if it's currently null/empty
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile && !profile.full_name) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: fullName.trim() })
          .eq("id", user.id);

        if (profileError) {
          console.warn("Failed to update profile full_name:", profileError);
        }
      }

      toast.success(t("pages.rides.booking.passengerInfo.success"));
      onComplete({
        fullName: fullName.trim(),
        idRecto: idRectoUrl,
        idVerso: idVersoUrl,
      });
    } catch (error) {
      console.error("Error submitting passenger info:", error);
      
      // Extract clear error message - handle both regular errors and Supabase errors
      let errorMessage = t("pages.rides.booking.passengerInfo.errors.saveError");
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("pages.rides.booking.passengerInfo.title")}
            </CardTitle>
            <CardDescription>
              {t("pages.rides.booking.passengerInfo.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("pages.rides.booking.passengerInfo.fullName")} *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("pages.rides.booking.passengerInfo.fullNamePlaceholder")}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="idRecto">{t("pages.rides.booking.passengerInfo.idRecto")} *</Label>
                <div className="space-y-2">
                  {idRectoPreview ? (
                    <div className="relative">
                      <img
                        src={idRectoPreview}
                        alt="CNI Recto"
                        className="w-full h-48 object-contain border rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setIdRectoFile(null);
                          setIdRectoPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="idRecto"
                      className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        {t("pages.rides.booking.passengerInfo.clickToUpload")}
                      </span>
                    </label>
                  )}
                  <input
                    id="idRecto"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file, setIdRectoFile, setIdRectoPreview);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idVerso">{t("pages.rides.booking.passengerInfo.idVerso")} *</Label>
                <div className="space-y-2">
                  {idVersoPreview ? (
                    <div className="relative">
                      <img
                        src={idVersoPreview}
                        alt="CNI Verso"
                        className="w-full h-48 object-contain border rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setIdVersoFile(null);
                          setIdVersoPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="idVerso"
                      className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        {t("pages.rides.booking.passengerInfo.clickToUpload")}
                      </span>
                    </label>
                  )}
                  <input
                    id="idVerso"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file, setIdVersoFile, setIdVersoPreview);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button onClick={onClose} variant="outline" disabled={submitting || isBusy}>
          {t("pages.rides.booking.passengerInfo.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            !fullName.trim() ||
            !idRectoFile ||
            !idVersoFile ||
            submitting ||
            isBusy
          }
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("pages.rides.booking.passengerInfo.saving")}
            </>
          ) : (
            <>
              {t("pages.rides.booking.passengerInfo.continue")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
