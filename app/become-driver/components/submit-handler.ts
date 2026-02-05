"use client";

import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "@/components/ui";
import { isValidDocumentUrl } from "../upload-utils";
import { trackSubmissionEvent } from "@/lib/analytics";
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
      console.log("✅ User can proceed with driver application");

      // Get the user profile to update it
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // ISO format timestamp for PostgreSQL compatibility
      const submissionIsoTimestamp = new Date().toISOString();
      // Numeric timestamp for duration calculations
      const submissionTimestamp = Date.now();

      // Construct submission data
      const driverDocument = {
        driver_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "pending",

        // Document details
        national_id_number: profile?.national_id || "",
        license_number: profile?.license_number || "",
        registration_number: profile?.registration_number || "",
        insurance_number: profile?.insurance_number || "",
        road_tax_number: profile?.road_tax_number || "", // included for compatibility

        // Document files - recto/verso (front/back)
        national_id_file_recto: nationalIdFileRecto,
        national_id_file_verso: nationalIdFileVerso,
        license_file_recto: licenseFileRecto,
        license_file_verso: licenseFileVerso,
        registration_file_recto: registrationFileRecto,
        registration_file_verso: registrationFileVerso,
        insurance_file_recto: insuranceFileRecto,
        insurance_file_verso: insuranceFileVerso,
        vehicle_images: vehicleImages, // Required - validated above
      };

      // Write to database
      console.log("📝 Submitting driver application...", driverDocument);

      // First, update profile with driver application status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          driver_application_status: "pending",
          driver_application_date: submissionIsoTimestamp,
          is_driver_applicant: true,
          is_driver: false,
          driver_status: "pending",
          role: "user",
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Then, insert document record
      const { data: docData, error: docError } = await supabase
        .from("driver_documents")
        .insert(driverDocument)
        .select();

      if (docError) throw docError;

      // Calculate submission duration for analytics
      const submissionDuration = Date.now() - submissionTimestamp;
      console.log(
        `✅ Driver application successful in ${submissionDuration}ms`
      );

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
