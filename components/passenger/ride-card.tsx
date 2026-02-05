import { motion } from "framer-motion";
import { format } from "date-fns";
import Link from "next/link";
import { useLocale } from "@/hooks";
import {
  MapPin,
  Users,
  MessageCircle,
  User,
  Car,
  Clock,
  Navigation,
} from "lucide-react";
import { Button, Badge, Card, CardContent, CardFooter, Avatar, AvatarFallback, AvatarImage } from "@/components/ui";
import type { RideWithDriver } from "@/types";

interface PassengerRideCardProps {
  ride: RideWithDriver;
  index: number;
  unreadCount: number;
  user: { id: string } | null;
  onBookingClick: (ride: RideWithDriver) => void;
  onChatClick: (ride: RideWithDriver) => void;
}

export function PassengerRideCard({
  ride,
  index,
  unreadCount,
  user,
  onBookingClick,
  onChatClick,
}: PassengerRideCardProps) {
  const { t } = useLocale();
  return (
    <motion.div
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
          {ride.driver?.vehicle_images && ride.driver.vehicle_images.length > 0 ? (
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
                        {ride.seats_available} {t("pages.rides.rideCard.places")}
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
                  {ride.car_model || t("pages.rides.rideCard.vehicle")}
                </p>
                <p className="text-muted-foreground capitalize">
                  {ride.car_color || t("pages.rides.rideCard.notSpecified")}
                </p>
                <Badge className="mt-2 bg-primary text-primary-foreground">
                  {ride.seats_available} {t("pages.rides.rideCard.places")}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("pages.rides.rideCard.photoNotAvailable")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <CardContent className="relative p-6 bg-card">
          {/* Driver Info - Only show for authenticated users */}
          {user ? (
            <Link
              href={`/drivers/${ride.driver_id}`}
              className="flex items-center gap-4 mb-6 hover:opacity-80 transition-opacity cursor-pointer"
            >
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
                <h3 className="font-bold text-foreground text-lg hover:text-primary transition-colors">
                  {ride.driver?.full_name || t("pages.rides.rideCard.driver")}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t("pages.rides.rideCard.certifiedDriver")}
                  </p>
                </div>
                <p className="text-xs text-primary mt-1 font-medium">
                  {t("pages.rides.rideCard.viewProfile")}
                </p>
              </div>
            </Link>
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
                  {t("pages.rides.rideCard.driver")} PikDrive
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t("pages.rides.rideCard.certified")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("pages.rides.rideCard.loginToSeeDetails")}
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
                      {t("pages.rides.rideCard.departurePoint")}
                    </p>
                  </div>
                  <div className="group/city">
                    <p className="font-bold text-foreground text-lg group-hover/city:text-primary transition-colors">
                      {ride.to_city}
                    </p>
                    <p className="text-muted-foreground text-sm font-medium">
                      {t("pages.rides.rideCard.destinationPoint")}
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

          {/* Pickup Points Info */}
          {ride.pickup_points && ride.pickup_points.length > 0 && (
            <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {ride.pickup_points.length} {ride.pickup_points.length === 1 
                    ? t("pages.rides.rideCard.pickupPoints") 
                    : t("pages.rides.rideCard.pickupPoints_plural")}
                </p>
              </div>
              {ride.pickup_points.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("pages.rides.rideCard.firstPickup")} {ride.pickup_points[0].name}
                </p>
              )}
            </div>
          )}

          {/* Time and Price with Enhanced Design */}
          <div className="bg-gradient-to-r from-muted/50 to-secondary/30 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    {t("pages.rides.rideCard.scheduledDeparture")}
                  </p>
                  <p className="font-bold text-foreground">
                    {format(new Date(ride.departure_time), "dd MMM à HH:mm")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground font-medium">
                  {t("pages.rides.rideCard.pricePerSeat")}
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
              onClick={() => onChatClick(ride)}
              className="flex-1 relative group/btn border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all duration-300"
            >
              <MessageCircle className="h-5 w-5 mr-2 group-hover/btn:animate-bounce" />
              <span className="font-semibold">{t("pages.rides.rideCard.contact")}</span>
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center text-xs font-bold animate-pulse"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
            <Button
              size="lg"
              disabled={ride.seats_available === 0}
              onClick={() => onBookingClick(ride)}
              className="flex-1 bg-gradient-to-r from-primary via-amber-500 to-primary hover:from-primary/90 hover:to-amber-500/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {ride.seats_available === 0 ? (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  {t("pages.rides.rideCard.full")}
                </>
              ) : (
                <>
                  <MapPin className="h-5 w-5 mr-2" />
                  {t("pages.rides.rideCard.book")}
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

