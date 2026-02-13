"use client";

import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "@/hooks/ui";
import { isValidDocumentUrl } from "../upload-utils";
import { trackSubmissionEvent } from "@/lib/analytics";
import { apiClient } from "@/lib/api-client";
import { submitDriverApplication, DriverApplicationData } from "@/lib/driver-application-utils";
import { formSchema } from "../form-schema";
import { useLocale } from "@/hooks";

// Custom hook for form submission logic
export function useFormSubmission(supabase: SupabaseClient, user: any) {
  const router = useRouter();
  const { t } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form submission handler
  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    // Document state
    nationalIdFileRecto: string,
    nationalIdFileVerso: string,
    licenseFileRecto: string,
    licenseFileVerso: string,
    registrationFileRecto: string,
    registrationFileVerso: string,
    insuranceFileRecto: string,
    insuranceFileVerso: string,
    vehicleImages: string[]
  ) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to apply as a driver.",
        variant: "destructive",
      });
      return;
    }

    // Validate all required documents have both recto and verso images
    const requiredDocs = [
      { name: "CNI (recto)", file: nationalIdFileRecto },
      { name: "CNI (verso)", file: nationalIdFileVerso },
      { name: "Permis (recto)", file: licenseFileRecto },
      { name: "Permis (verso)", file: licenseFileVerso },
      { name: "Carte Grise (recto)", file: registrationFileRecto },
      { name: "Carte Grise (verso)", file: registrationFileVerso },
      { name: "Certificat d'Assurance (recto)", file: insuranceFileRecto },
      { name: "Certificat d'Assurance (verso)", file: insuranceFileVerso },
    ];

    const missingDocs = requiredDocs.filter(
      (doc) => !doc.file || !isValidDocumentUrl(doc.file)
    );

    if (missingDocs.length > 0) {
      toast({
        title: t("pages.becomeDriver.form.errors.missingDocuments"),
        description: t("pages.becomeDriver.form.errors.missingDocumentsDesc", { documents: missingDocs.map((d) => d.name).join(", ") }),
        variant: "destructive",
      });
      return;
    }

    // Validate vehicle images are required
    if (!vehicleImages || vehicleImages.length === 0) {
      toast({
        title: t("pages.becomeDriver.form.errors.vehicleImagesRequired"),
        description: t("pages.becomeDriver.form.errors.vehicleImagesRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const submissionIsoTimestamp = new Date().toISOString();
      // Numeric timestamp for duration calculations
      const submissionTimestamp = Date.now();

      // Delegate submission logic to shared service
      const driverData: DriverApplicationData = {
        driver_id: user.id,
        national_id_file_recto: nationalIdFileRecto,
        national_id_file_verso: nationalIdFileVerso,
        license_file_recto: licenseFileRecto,
        license_file_verso: licenseFileVerso,
        registration_file_recto: registrationFileRecto,
        registration_file_verso: registrationFileVerso,
        insurance_file_recto: insuranceFileRecto,
        insurance_file_verso: insuranceFileVerso,
        vehicle_images: vehicleImages,
      };

      const submitResult = await submitDriverApplication(supabase, user.id, driverData);
      if (!submitResult.success) {
        throw new Error(submitResult.error || 'Failed to submit application');
      }

      // Notify admins about new driver application (best-effort, does not block UX)
      void apiClient.post('/api/admin/driver-applications/notify', {
        driverId: user.id,
        submittedAt: submissionIsoTimestamp,
      }).catch((notifyError) => {
        console.error('Failed to notify admins for driver application submission:', notifyError);
      });
      // Calculate submission duration for analytics
      const submissionDuration = Date.now() - submissionTimestamp;

      // Track event for analytics
      trackSubmissionEvent({
        userId: user.id,
        documentCount: requiredDocs.length,
        processingTime: submissionDuration,
        // Additional properties as needed
      });

      // Show success toast
      toast({
        title: t("pages.becomeDriver.form.errors.submitted"),
        description: t("pages.becomeDriver.form.errors.submittedDesc"),
      });

      // Navigate to success page
      router.push("/become-driver/success");
    } catch (error) {
      console.error("❌ Error submitting driver application:", error);
      toast({
        title: t("pages.becomeDriver.form.errors.error"),
        description: t("pages.becomeDriver.form.errors.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    onSubmit,
  };
}

