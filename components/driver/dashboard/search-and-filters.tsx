import { Search, SlidersHorizontal } from "lucide-react";
import { Button, Input, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui";
import { useLocale } from "@/hooks";

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
}

export function SearchAndFilters({
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
}: SearchAndFiltersProps) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 items-stretch sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("pages.driver.dashboard.searchPlaceholder")}
          className="pl-8 text-sm sm:text-base"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-center sm:justify-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 w-full sm:w-auto text-sm"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">
                {t("pages.driver.dashboard.sort.label")}{" "}
                {sortOrder === "asc" ? t("pages.driver.dashboard.sort.earliest") : t("pages.driver.dashboard.sort.latest")}
              </span>
              <span className="sm:hidden">
                {sortOrder === "asc" ? t("pages.driver.dashboard.sort.earliestShort") : t("pages.driver.dashboard.sort.latestShort")}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onSortChange("asc")}>
              {t("pages.driver.dashboard.sort.earliest")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("desc")}>
              {t("pages.driver.dashboard.sort.latest")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
