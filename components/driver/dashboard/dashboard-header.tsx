import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DashboardHeader() {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold">Vos trajets</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos trajets et réservations
        </p>
      </div>
      <Button onClick={() => router.push("/driver/rides/new")}>
        <Plus className="w-4 h-4 mr-2" />
        Créer un trajet
      </Button>
    </div>
  );
}
