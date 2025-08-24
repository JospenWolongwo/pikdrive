import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DashboardHeader() {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Vos trajets</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Gérez vos trajets et réservations
        </p>
      </div>
      <Button
        onClick={() => router.push("/driver/rides/new")}
        className="w-full sm:w-auto text-sm sm:text-base"
      >
        <Plus className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Créer un trajet</span>
        <span className="sm:hidden">Nouveau trajet</span>
      </Button>
    </div>
  );
}
