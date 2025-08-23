import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher par ville, passager ou modèle de voiture..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Trier{" "}
              {sortOrder === "asc" ? "Plus tôt d'abord" : "Plus tard d'abord"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSortChange("asc")}>
              Plus tôt d'abord
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("desc")}>
              Plus tard d'abord
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
