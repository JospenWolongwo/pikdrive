import { Alert, AlertDescription, AlertTitle, Button } from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import type { TranslateFn } from "../types";

interface CommonStateProps {
  t: TranslateFn;
  onBackToDashboard: () => void;
}

export function ManageRideLoadingState({ t }: Pick<CommonStateProps, "t">) {
  return (
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
  );
}

export function ManageRideErrorState({
  t,
  onBackToDashboard,
  error,
}: CommonStateProps & { error: string }) {
  return (
    <div className="text-center py-12">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("pages.driver.manageRide.errors.title")}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={onBackToDashboard}>
        {t("pages.driver.manageRide.backToDashboard")}
      </Button>
    </div>
  );
}

export function ManageRideNotFoundState({
  t,
  onBackToDashboard,
}: CommonStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-lg text-gray-500">
        {t("pages.driver.manageRide.errors.notFound")}
      </p>
      <Button className="mt-4" onClick={onBackToDashboard}>
        {t("pages.driver.manageRide.backToDashboard")}
      </Button>
    </div>
  );
}
