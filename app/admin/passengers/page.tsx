"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2,
  RefreshCw,
  Eye,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow } from "date-fns";
import { useAdminAccess } from "@/hooks/admin";
import PassengerDetail from "./passenger-detail";

interface PassengerApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  documents: {
    id?: string;
    user_id?: string;
    full_name: string;
    national_id_file_recto: string;
    national_id_file_verso: string;
    created_at: string;
    updated_at: string;
  };
}

export default function AdminPassengersPage() {
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const [passengers, setPassengers] = useState<PassengerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPassenger, setSelectedPassenger] =
    useState<PassengerApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadPassengers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/admin/passengers');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load passengers');
      }

      setPassengers(result.data || []);
    } catch (error) {
      console.error("Error loading passengers:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les passagers.",
        variant: "destructive",
      });
      setPassengers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === true) {
      loadPassengers();
    }
  }, [isAdmin, loadPassengers]);

  const handleViewPassenger = (passenger: PassengerApplication) => {
    setSelectedPassenger(passenger);
    setIsDetailOpen(true);
  };

  const handleManualRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      loadPassengers();
    }, 300);
  };

  // Filter passengers by search query
  const filteredPassengers = passengers.filter((passenger) => {
    const query = searchQuery.toLowerCase();
    return (
      passenger.full_name.toLowerCase().includes(query) ||
      passenger.email.toLowerCase().includes(query) ||
      passenger.phone.toLowerCase().includes(query) ||
      (passenger.city && passenger.city.toLowerCase().includes(query))
    );
  });

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion des Passagers
          </h1>
          <p className="text-muted-foreground mt-2">
            Consulter les informations et documents des passagers.
          </p>
        </div>
        <Button
          onClick={handleManualRefresh}
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Rechercher par nom, email, téléphone ou ville..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Passager</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Date d'enregistrement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || adminLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredPassengers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  {searchQuery
                    ? "Aucun passager trouvé pour cette recherche."
                    : "Aucun passager trouvé."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPassengers.map((passenger) => (
                <TableRow key={passenger.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={passenger.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                          {passenger.full_name
                            ? passenger.full_name.charAt(0).toUpperCase()
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {passenger.full_name || "Unknown Passenger"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>{passenger.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {passenger.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{passenger.city || "N/A"}</div>
                  </TableCell>
                  <TableCell>
                    {passenger.documents ? (
                      <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                        Complet
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                        Incomplet
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {passenger.created_at
                        ? format(new Date(passenger.created_at), "PPp")
                        : "N/A"}
                    </div>
                    {passenger.created_at && (
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(passenger.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPassenger(passenger)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Voir
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedPassenger && (
        <PassengerDetail
          open={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedPassenger(null);
          }}
          passenger={selectedPassenger}
        />
      )}
    </div>
  );
}

