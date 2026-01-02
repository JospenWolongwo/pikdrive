import { MapPin } from "lucide-react";
import { useLocale } from "@/hooks";

interface RidesEmptyStateProps {
  hasFilters: boolean;
}

export function RidesEmptyState({ hasFilters }: RidesEmptyStateProps) {
  const { t } = useLocale();
  return (
    <div className="text-center py-20">
      <div className="max-w-lg mx-auto">
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/10 to-accent/20 rounded-full flex items-center justify-center animate-float">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-ping"></div>
        </div>
        <h3 className="text-2xl font-bold mb-3 text-foreground">
          {t("pages.rides.emptyState.title")}
        </h3>
        <p className="text-muted-foreground text-lg">
          {hasFilters
            ? t("pages.rides.emptyState.withFilters")
            : t("pages.rides.emptyState.withoutFilters")}
        </p>
      </div>
    </div>
  );
}

