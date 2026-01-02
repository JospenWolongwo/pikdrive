import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLocale } from "@/hooks";

export function DashboardHeader() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("pages.driver.dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t("pages.driver.dashboard.description")}
        </p>
      </div>
      <Button
        onClick={() => router.push("/driver/rides/new")}
        className="w-full sm:w-auto text-sm sm:text-base"
      >
        <Plus className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">{t("pages.driver.dashboard.createRide")}</span>
        <span className="sm:hidden">{t("pages.driver.dashboard.newRide")}</span>
      </Button>
    </div>
  );
}
