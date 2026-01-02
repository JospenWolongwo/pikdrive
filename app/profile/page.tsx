"use client";

import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "@/hooks";
import { useProfile } from "@/hooks/profile";
import { useToast } from "@/hooks";
import { Button } from "@/components/ui/button";
import { User, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileOverviewCard } from "@/components/profile/ProfileOverviewCard";
import { PersonalInfoCard } from "@/components/profile/PersonalInfoCard";
import { DriverDocumentsCard } from "@/components/profile/DriverDocumentsCard";
import { StatusCard } from "@/components/profile/StatusCard";
import { QuickActionsCard } from "@/components/profile/QuickActionsCard";
import type { DriverDocuments } from "@/types/user";

export default function ProfilePage() {
  const { user, supabase } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useLocale();

  const { profileData, driverDocuments, isLoading, refreshProfile } = useProfile(
    user?.id
  );

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: error.message,
      });
    }
  };

  const handleAvatarUpdated = (avatarUrl: string) => {
    // Avatar update is handled by the hook, this is just for callback if needed
  };

  const handleDocumentsUpdated = (documents: DriverDocuments) => {
    // Documents update is handled by the hook, this is just for callback if needed
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">
              {t("pages.profile.loadingProfile")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no profile data and not loading
  if (!profileData || !profileData.phone) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t("pages.profile.notFound")}</h1>
          <p className="text-muted-foreground">
            {t("pages.profile.notFoundDescription")}
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={refreshProfile} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("pages.profile.retry")}
            </Button>
            <Button onClick={() => router.push("/")}>
              {t("pages.profile.goHome")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <ProfileHeader
          profileData={profileData}
          isLoading={isLoading}
          onRefresh={refreshProfile}
          onSignOut={handleSignOut}
        />

        {/* Profile Overview Card */}
        <ProfileOverviewCard
          profileData={profileData}
          user={user}
          userId={user.id}
          onAvatarUpdated={handleAvatarUpdated}
        />
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Personal Information */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <PersonalInfoCard
              profileData={profileData}
              user={user}
              userId={user.id}
            />
          </motion.div>

          {/* Driver Documents Section */}
          {profileData.is_driver_applicant && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <DriverDocumentsCard
                profileData={profileData}
                driverDocuments={driverDocuments}
                userId={user.id}
                onDocumentsUpdated={handleDocumentsUpdated}
              />
            </motion.div>
          )}
        </div>

        {/* Right Column - Status & Actions */}
        <div className="space-y-6">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatusCard profileData={profileData} />
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <QuickActionsCard profileData={profileData} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
