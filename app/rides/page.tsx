"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { useRidesStore, useBookingStore } from "@/stores";
import type { RideWithDriver } from "@/types";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Users,
  MessageCircle,
  Phone,
  Search,
  Filter,
  User,
  Car,
} from "lucide-react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  allCameroonCities,
  citiesByRegion,
  urbanCommunes,
} from "@/app/data/cities";
import { Slider } from "@/components/ui/slider";
import { ChatDialog } from "@/components/chat/chat-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { BookingModal } from "./booking-modal";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import {
  initializeGlobalBookingNotificationManager,
  cleanupGlobalBookingNotificationManager,
} from "@/lib/notifications/booking-notification-manager";

interface Booking {
  seats: number;
}

// Using RideWithDriver type from store instead of local interface

interface UnreadCount {
  rideId: string;
  count: number;
}

interface UnreadCounts {
  [key: string]: number;
}

const sortedCameroonCities = allCameroonCities;

export default function RidesPage() {
  const { supabase, user } = useSupabase();
  const { unreadCounts: unreadCountsArray, subscribeToRide, conversations } = useChatStore();
  const { toast } = useToast();
  const router = useRouter();
  const { 
    allRides, 
    allRidesLoading, 
    allRidesError, 
    allRidesPagination, 
    searchRides, 
    fetchAllRides,
    lastAllRidesFetch,
    subscribeToRideUpdates, 
    unsubscribeFromRideUpdates 
  } = useRidesStore();
  const { fetchUserBookings } = useBookingStore();
  const loading = allRidesLoading;
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideWithDriver | null>(null);
  const [selectedChatRide, setSelectedChatRide] = useState<{
    ride: RideWithDriver;
    conversationId: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [seats, setSeats] = useState(1);

  // Search filters
  const [fromCity, setFromCity] = useState<string | null>(null);
  const [toCity, setToCity] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(20000);
  const [minSeats, setMinSeats] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Temporary filter states (don't trigger search)
  const [tempFromCity, setTempFromCity] = useState<string | null>(fromCity);
  const [tempToCity, setTempToCity] = useState<string | null>(toCity);
  const [tempMinPrice, setTempMinPrice] = useState(minPrice);
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);
  const [tempMinSeats, setTempMinSeats] = useState(minSeats);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Convert unreadCounts array to dictionary by rideId
  // Since unreadCounts are now stored by conversationId, we need to map them to rideId
  const unreadCounts: UnreadCounts = (unreadCountsArray || []).reduce(
    (acc: UnreadCounts, curr) => {
      // Find the conversation to get the rideId
      const conversation = conversations.find(conv => conv.id === curr.conversationId);
      if (conversation) {
        acc[conversation.rideId] = curr.count;
      }
      return acc;
    },
    {} as UnreadCounts
  );

  const loadRides = useCallback(
    async (filters?: {
      fromCity?: string | null;
      toCity?: string | null;
      minPrice?: number;
      maxPrice?: number;
      minSeats?: number;
    }) => {
      try {
        // Use provided filters or current state
        const activeFromCity = filters?.fromCity ?? fromCity;
        const activeToCity = filters?.toCity ?? toCity;
        const activeMinPrice = filters?.minPrice ?? minPrice;
        const activeMaxPrice = filters?.maxPrice ?? maxPrice;
        const activeMinSeats = filters?.minSeats ?? minSeats;

        const hasFilters = Boolean(
          (activeFromCity && activeFromCity !== "any") ||
          (activeToCity && activeToCity !== "any") ||
          activeMinPrice !== 0 ||
          activeMaxPrice !== 20000 ||
          activeMinSeats !== 1
        );

        if (hasFilters) {
          await searchRides({
            from_city: activeFromCity && activeFromCity !== "any" ? activeFromCity : undefined,
            to_city: activeToCity && activeToCity !== "any" ? activeToCity : undefined,
            min_price: activeMinPrice,
            max_price: activeMaxPrice,
            min_seats: activeMinSeats,
            page: currentPage,
            limit: itemsPerPage,
          });
        } else {
          await fetchAllRides({ page: currentPage, limit: itemsPerPage, upcoming: true });
        }

        // Update pagination from store response
        if (allRidesPagination) {
          setTotalPages(allRidesPagination.total_pages);
        }

        // Rides are now managed by Zustand store

        // Vehicle images and other data are handled by the Zustand store


        // All ride processing is handled by the Zustand store
      } catch (error) {
        console.error("Error loading rides:", error);
        toast({
          variant: "destructive",
          title: "Error loading rides",
          description: "Please try again later.",
        });
      }
    },
    [
      searchRides,
      fetchAllRides,
      fromCity,
      toCity,
      minPrice,
      maxPrice,
      minSeats,
      currentPage,
      itemsPerPage,
    ]
  );

  // Load rides on component mount
  useEffect(() => {
    const fresh = lastAllRidesFetch && Date.now() - lastAllRidesFetch < 5 * 60 * 1000;
    if (!fresh || allRides.length === 0) {
      loadRides();
    }
    // else: keep cached list, avoid refetch on navigation
  }, []); // Run once on mount
  
  // Subscribe to real-time ride updates for seat availability
  useEffect(() => {
    if (supabase && allRides.length > 0) {
      subscribeToRideUpdates(supabase);
      
      return () => {
        unsubscribeFromRideUpdates();
      };
    }
  }, [supabase, allRides.length, subscribeToRideUpdates, unsubscribeFromRideUpdates]);

  useEffect(() => {
    loadRides();
  }, [currentPage, loadRides]);

  // Reset navigation state when user changes
  useEffect(() => {
    setIsNavigating(false);
  }, [user]);

  // Separate function for search/filter
  const handleSearch = useCallback(() => {
    // Apply temporary filters to actual filters
    setFromCity(tempFromCity);
    setToCity(tempToCity);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setMinSeats(tempMinSeats);
    setCurrentPage(1); // Reset to first page when searching

    // Load rides with the new filters
    loadRides({
      fromCity: tempFromCity,
      toCity: tempToCity,
      minPrice: tempMinPrice,
      maxPrice: tempMaxPrice,
      minSeats: tempMinSeats,
    });
  }, [
    tempFromCity,
    tempToCity,
    tempMinPrice,
    tempMaxPrice,
    tempMinSeats,
    loadRides,
  ]);

  useEffect(() => {
    allRides.forEach((ride) => {
      subscribeToRide(ride.id);
    });
  }, [allRides, subscribeToRide]);

  // Preload user bookings for instant modal performance
  useEffect(() => {
    if (user?.id && fetchUserBookings) {
      fetchUserBookings(user.id);
    }
  }, [user?.id]); // Remove fetchUserBookings from dependencies

  // Set up global booking notification manager
  useEffect(() => {
    if (!user || typeof window === "undefined") {
      cleanupGlobalBookingNotificationManager();
      return;
    }

    // Prevent multiple managers from starting
    if (window.__bookingNotificationManager) {
      return;
    }

    const manager = initializeGlobalBookingNotificationManager(
      supabase,
      user.id,
      () => {
        // Navigate to bookings page when notification is clicked
        router.push("/bookings");
      }
    );

    try {
      manager.start();
    } catch (error) {
      console.error("❌ Failed to start BookingNotificationManager:", error);
    }

    return () => {
      cleanupGlobalBookingNotificationManager();
    };
  }, [user, supabase, router]);

  const handleBooking = (ride: RideWithDriver) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour réserver un trajet.",
        variant: "destructive",
      });
      // Use replace instead of push for faster navigation
      setIsNavigating(true);
      router.replace("/auth?redirect=/rides");
      return;
    }
    setSelectedRide(ride);
  };

  const handleBookingComplete = () => {
    loadRides(); // Refresh the rides list
  };

  const handleOpenChat = async (ride: RideWithDriver) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour contacter le conducteur.",
        variant: "destructive",
      });
      // Use replace instead of push for faster navigation
      setIsNavigating(true);
      router.replace("/auth?redirect=/rides");
      return;
    }

    // Find the conversation for this ride and driver
    const conversation = conversations.find(conv => 
      conv.rideId === ride.id && conv.otherUserId === ride.driver_id
    );
    
    if (conversation) {
      setSelectedChatRide({ ride, conversationId: conversation.id });
    } else {
      // If no conversation exists, we'll need to create one
      // For now, we'll use the rideId as a fallback and let the ChatDialog handle creation
      setSelectedChatRide({ ride, conversationId: ride.id });
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedRide) return;

    // Filter sensitive content
    const filteredMessage = filterSensitiveContent(message);

    if (filteredMessage !== message) {
      toast({
        title: "Message Modified",
        description:
          "Your message was modified to remove sensitive information.",
        variant: "default",
      });
    }

    try {
      const { error } = await supabase.from("messages").insert([
        {
          sender_id: user.id,
          receiver_id: selectedRide.driver_id,
          ride_id: selectedRide.id,
          content: filteredMessage,
          status: "sent",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message sent successfully!",
      });

      setMessage("");
      setSelectedRide(null);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    }
  };

  const filterSensitiveContent = (text: string): string => {
    // Filter phone numbers
    text = text.replace(
      /\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      "[phone number removed]"
    );

    // Filter email addresses
    text = text.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      "[email removed]"
    );

    // Filter WhatsApp mentions
    text = text.replace(/\b(?:whatsapp|whats app|wa)\b/gi, "[messaging app]");

    // Filter common meeting places or arrangements
    const sensitiveWords = [
      "meet",
      "meetup",
      "meeting",
      "contact",
      "call me",
      "text me",
      "message me",
      "telegram",
      "signal",
      "facebook",
      "fb",
      "instagram",
      "ig",
      "dm",
    ];

    const sensitivePattern = new RegExp(
      `\\b(${sensitiveWords.join("|")})\\b`,
      "gi"
    );
    text = text.replace(sensitivePattern, "[arrangement removed]");

    return text;
  };

  if (loading) {
    return (
      <div className="container py-10">
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Chargement des trajets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6 relative">
      {/* Navigation Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Redirection en cours...</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Trajets Disponibles
          </h1>
          <p className="text-muted-foreground">
            Trouvez et réservez votre prochain trajet
          </p>
        </div>

        {/* Mobile-optimized filter layout */}
        <div className="space-y-4">
          {/* Main search row */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Departure city */}
            <div className="flex-1 space-y-2">
              <Label htmlFor="from-city" className="text-sm font-medium">
                De
              </Label>
              <SearchableSelect
                options={sortedCameroonCities}
                value={tempFromCity || ""}
                onValueChange={setTempFromCity}
                placeholder="Sélectionnez la ville de départ"
                searchPlaceholder="Rechercher une ville de départ..."
              />
            </div>

            {/* Destination city */}
            <div className="flex-1 space-y-2">
              <Label htmlFor="to-city" className="text-sm font-medium">
                À
              </Label>
              <SearchableSelect
                options={sortedCameroonCities}
                value={tempToCity || ""}
                onValueChange={setTempToCity}
                placeholder="Sélectionnez la ville de destination"
                searchPlaceholder="Rechercher une ville de destination..."
              />
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSearch}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Search className="h-4 w-4 mr-2" />
              Rechercher
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-secondary" : ""}
              >
                <Filter className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setTempFromCity(null);
                  setTempToCity(null);
                  setTempMinPrice(0);
                  setTempMaxPrice(20000);
                  setTempMinSeats(1);
                  setFromCity(null);
                  setToCity(null);
                  setMinPrice(0);
                  setMaxPrice(20000);
                  setMinSeats(1);
                  setCurrentPage(1);
                  loadRides();
                }}
                className="hover:bg-secondary"
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Fourchette de Prix (FCFA)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={tempMinPrice}
                    onChange={(e) => setTempMinPrice(Number(e.target.value))}
                    className="flex-1"
                    min={0}
                    max={tempMaxPrice}
                    placeholder="Min"
                  />
                  <span className="text-muted-foreground">à</span>
                  <Input
                    type="number"
                    value={tempMaxPrice}
                    onChange={(e) => setTempMaxPrice(Number(e.target.value))}
                    className="flex-1"
                    min={tempMinPrice}
                    max={20000}
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Places Minimum</Label>
                <Input
                  type="number"
                  value={tempMinSeats}
                  onChange={(e) =>
                    setTempMinSeats(
                      Math.max(1, Math.min(4, Number(e.target.value)))
                    )
                  }
                  min={1}
                  max={4}
                  className="w-full max-w-[120px]"
                />
              </div>
            </div>
          )}
        </div>

        {allRides.length === 0 ? (
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
                Aucun voyage trouvé
              </h3>
              <p className="text-muted-foreground text-lg">
                {(fromCity && fromCity !== "any") ||
                (toCity && toCity !== "any")
                  ? "Modifiez vos critères pour découvrir plus de trajets."
                  : "Aucun trajet disponible pour le moment. Revenez bientôt !"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {([...allRides]
              .sort((a, b) =>
                new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
              )).map((ride, index) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group"
              >
                <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-card">
                  {/* Dynamic Background Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full"></div>

                  {/* Car Image Section */}
                  <div className="relative h-56 bg-gradient-to-br from-muted to-secondary/30 overflow-hidden">
                    {ride.driver?.vehicle_images &&
                    ride.driver.vehicle_images.length > 0 ? (
                      <div className="relative h-full">
                        <img
                          src={ride.driver.vehicle_images[0]}
                          alt={`${ride.car_model} ${ride.car_color}`}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const nextElement = e.currentTarget
                              .nextElementSibling as HTMLElement;
                            if (nextElement) {
                              nextElement.style.display = "flex";
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-white/95 dark:bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20 dark:border-white/10">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-foreground text-lg">
                                  {ride.car_model}
                                </p>
                                <p className="text-muted-foreground capitalize">
                                  {ride.car_color}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <Badge className="bg-primary text-primary-foreground font-semibold">
                                  {ride.seats_available} places
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Speed lines animation */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500">
                          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted dark:from-secondary/80 dark:to-muted/60">
                        <div className="text-center p-6">
                          <div className="relative">
                            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center group-hover:animate-bounce">
                              <Car className="w-10 h-10 text-primary-foreground" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full animate-ping"></div>
                          </div>
                          <p className="text-lg font-bold text-foreground">
                            {ride.car_model || "Véhicule"}
                          </p>
                          <p className="text-muted-foreground capitalize">
                            {ride.car_color || "Non spécifié"}
                          </p>
                          <Badge className="mt-2 bg-primary text-primary-foreground">
                            {ride.seats_available} places
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-2">
                            Photo du véhicule non disponible
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <CardContent className="relative p-6 bg-card">
                    {/* Driver Info - Only show for authenticated users */}
                    {user ? (
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                          <Avatar className="h-12 w-12 border-3 border-primary/20 shadow-lg">
                            <AvatarImage src={ride.driver?.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-amber-500 text-primary-foreground font-bold text-lg">
                              {ride.driver?.full_name?.charAt(0) || "D"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground text-lg">
                            {ride.driver?.full_name || "Chauffeur"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <p className="text-muted-foreground text-sm font-medium">
                              Conducteur certifié PikDrive
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                          <Avatar className="h-12 w-12 border-3 border-primary/20 shadow-lg">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-amber-500 text-primary-foreground font-bold text-lg">
                              <User className="w-6 h-6" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground text-lg">
                            Conducteur PikDrive
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <p className="text-muted-foreground text-sm font-medium">
                              Conducteur certifié
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Connectez-vous pour voir les détails du conducteur
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Route Info with Animation */}
                    <div className="space-y-4 mb-6">
                      <div className="relative">
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center pt-1">
                            <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-600 rounded-full shadow-lg animate-pulse"></div>
                            <div className="w-1 h-12 bg-gradient-to-b from-green-500 via-primary/50 to-red-500 mt-2 rounded-full"></div>
                            <div className="w-4 h-4 bg-gradient-to-r from-red-400 to-red-600 rounded-full shadow-lg animate-pulse"></div>
                          </div>
                          <div className="flex-1 space-y-4 pt-1">
                            <div className="group/city">
                              <p className="font-bold text-foreground text-lg group-hover/city:text-primary transition-colors">
                                {ride.from_city}
                              </p>
                              <p className="text-muted-foreground text-sm font-medium">
                                Point de départ
                              </p>
                            </div>
                            <div className="group/city">
                              <p className="font-bold text-foreground text-lg group-hover/city:text-primary transition-colors">
                                {ride.to_city}
                              </p>
                              <p className="text-muted-foreground text-sm font-medium">
                                Destination finale
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Animated travel indicator */}
                        <div
                          className="absolute left-[7px] top-6 w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: "0.5s" }}
                        ></div>
                      </div>
                    </div>

                    {/* Time and Price with Enhanced Design */}
                    <div className="bg-gradient-to-r from-muted/50 to-secondary/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground font-medium">
                              Départ prévu
                            </p>
                            <p className="font-bold text-foreground">
                              {format(
                                new Date(ride.departure_time),
                                "dd MMM à HH:mm"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground font-medium">
                            Prix par place
                          </p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-3xl font-black text-primary">
                              {ride.price.toLocaleString()}
                            </p>
                            <p className="text-sm font-bold text-muted-foreground">
                              FCFA
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  {/* Enhanced Action Buttons */}
                  <CardFooter className="p-6 pt-0 bg-gradient-to-t from-muted/20 to-transparent">
                    <div className="flex gap-3 w-full">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => handleOpenChat(ride)}
                        className="flex-1 relative group/btn border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all duration-300"
                      >
                        <MessageCircle className="h-5 w-5 mr-2 group-hover/btn:animate-bounce" />
                        <span className="font-semibold">Contacter</span>
                        {unreadCounts[ride.id] > 0 && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center text-xs font-bold animate-pulse"
                          >
                            {unreadCounts[ride.id]}
                          </Badge>
                        )}
                      </Button>
                      <Button
                        size="lg"
                        disabled={ride.seats_available === 0}
                        onClick={() => handleBooking(ride)}
                        className="flex-1 bg-gradient-to-r from-primary via-amber-500 to-primary hover:from-primary/90 hover:to-amber-500/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      >
                        {ride.seats_available === 0 ? (
                          <>
                            <Users className="h-5 w-5 mr-2" />
                            Complet
                          </>
                        ) : (
                          <>
                            <MapPin className="h-5 w-5 mr-2" />
                            Réserver
                          </>
                        )}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {!loading && allRides.length > 0 && (
        <Pagination className="mt-4">
          <PaginationContent>
            {currentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.max(1, prev - 1));
                  }}
                />
              </PaginationItem>
            )}

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber: number;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }

              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(pageNumber);
                    }}
                    isActive={currentPage === pageNumber}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                  }}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
      {selectedRide && (
        <BookingModal
          isOpen={!!selectedRide}
          onClose={() => setSelectedRide(null)}
          ride={selectedRide}
          onBookingComplete={handleBookingComplete}
        />
      )}
      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={() => setSelectedChatRide(null)}
          rideId={selectedChatRide.ride.id}
          conversationId={selectedChatRide.conversationId}
          otherUserId={selectedChatRide.ride.driver_id}
          otherUserName={selectedChatRide.ride.driver?.full_name || "Driver"}
          otherUserAvatar={selectedChatRide.ride.driver?.avatar_url}
        />
      )}
    </div>
  );
}
