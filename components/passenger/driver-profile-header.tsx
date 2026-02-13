import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { MapPin, Shield, Star } from "lucide-react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "@/hooks";
import { withCacheBuster } from "@/lib/utils/cache-buster";
import { useEffect, useState } from "react";

interface DriverProfileHeaderProps {
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  memberSince: string;
  isVerified: boolean;
  average_rating?: number;
  total_reviews?: number;
}

export function DriverProfileHeader({
  full_name,
  avatar_url,
  city,
  memberSince,
  isVerified,
  average_rating,
  total_reviews,
}: DriverProfileHeaderProps) {
  const { supabase } = useSupabase();
  const { t } = useLocale();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (avatar_url) {
      // Check if it's already a full URL
      if (avatar_url.startsWith('http')) {
        setAvatarUrl(withCacheBuster(avatar_url));
      } else {
        // Convert storage path to full URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(avatar_url);
        setAvatarUrl(withCacheBuster(publicUrl));
      }
    }
  }, [avatar_url, supabase]);

  return (
    <div className="flex flex-col items-center text-center space-y-4 pb-8 border-b">
      {/* Avatar with verification badge */}
      <div className="relative">
        <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl">
          <AvatarImage src={avatarUrl || undefined} alt={full_name} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-amber-500 text-primary-foreground text-4xl font-bold">
            {full_name?.charAt(0) || "D"}
          </AvatarFallback>
        </Avatar>
        {isVerified && (
          <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-background shadow-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Driver name */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">{full_name}</h1>
        
        {/* Rating */}
        {average_rating && total_reviews && total_reviews > 0 && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <span className="text-xl font-semibold">{average_rating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              ({total_reviews} {t("pages.driverProfile.reviewsCount")})
            </span>
          </div>
        )}
        
        {/* City location */}
        {city && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-lg">{city}</span>
          </div>
        )}
      </div>

      {/* Certification badge and member since */}
      <div className="flex flex-col items-center gap-3">
        <Badge
          variant="default"
          className="bg-gradient-to-r from-primary to-amber-500 text-primary-foreground px-4 py-1.5 text-sm font-semibold"
        >
          <Shield className="h-4 w-4 mr-2" />
          {t("pages.driverProfile.certifiedDriver")}
        </Badge>

        {memberSince && (
          <p className="text-sm text-muted-foreground">
            {t("pages.driverProfile.memberSince")} {memberSince}
          </p>
        )}
      </div>
    </div>
  );
}
