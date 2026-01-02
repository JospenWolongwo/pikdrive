"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useLocale } from "@/hooks";

interface BookingSuccessStepProps {
  paymentSuccess: boolean;
  onClose: () => void;
}

export function BookingSuccessStep({
  paymentSuccess,
  onClose,
}: BookingSuccessStepProps) {
  const { t } = useLocale();
  return (
    <>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold">{t("pages.rides.booking.success.title")}</h3>
        <p className="text-muted-foreground">
          {t("pages.rides.booking.success.description")}
        </p>
        {paymentSuccess && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("pages.rides.booking.success.redirecting")}</span>
          </div>
        )}
        {!paymentSuccess && (
          <div className="mt-6">
            <Button onClick={onClose} className="w-full">
              {t("pages.rides.booking.success.done")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

