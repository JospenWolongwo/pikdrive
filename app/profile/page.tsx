"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { useSupabase } from "@/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/ui";
import {
  Camera,
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Shield,
  Car,
  FileText,
  CheckCircle,
  AlertCircle,
  Edit3,
  Save,
  X,
  Calendar,
  Badge,
  Star,
  Settings,
  LogOut,
  Clock,
  RefreshCw,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { allCameroonCities } from "@/app/data/cities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  avatar_url: string | null;
  is_driver: boolean;
  driver_status: string;
  role: string;
  driver_application_status: string;
  driver_application_date: string | null;
  is_driver_applicant: boolean;
  created_at: string;
  updated_at: string;
}

interface DriverDocuments {
  vehicle_images: string[] | null;
  status: string;
  created_at: string;
  national_id_file_recto: string | null;
  national_id_file_verso: string | null;
  license_file_recto: string | null;
  license_file_verso: string | null;
  registration_file_recto: string | null;
  registration_file_verso: string | null;
  insurance_file_recto: string | null;
  insurance_file_verso: string | null;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingVehicleImages, setIsEditingVehicleImages] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    avatar_url: null,
    is_driver: false,
    driver_status: "pending",
    role: "user",
    driver_application_status: "pending",
    driver_application_date: null,
    is_driver_applicant: false,
    created_at: "",
    updated_at: "",
  });
  const [driverDocuments, setDriverDocuments] =
    useState<DriverDocuments | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    city: "",
  });
  const [vehicleImages, setVehicleImages] = useState<string[]>([]);
  const [vehicleImagesLoading, setVehicleImagesLoading] = useState(false);
  const [newVehicleImages, setNewVehicleImages] = useState<File[]>([]);
  const [newVehicleImageUrls, setNewVehicleImageUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    loadProfile();
  }, [user, router]);

  // Add a manual refresh function
  const refreshProfile = async () => {
    if (user) {
      await loadProfile();
    }
  };

  // Add real-time subscription to profile changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log("🔄 Profile updated in real-time:", payload);
          // Update local state with new data
          if (payload.new) {
            setProfileData((prev) => ({ ...prev, ...payload.new }));
            // Also update form data if relevant fields changed
            if (
              payload.new.full_name ||
              payload.new.email ||
              payload.new.city
            ) {
              setFormData((prev) => ({
                ...prev,
                fullName: payload.new.full_name || prev.fullName,
                email: payload.new.email || prev.email,
                city: payload.new.city || prev.city,
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      newVehicleImageUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [newVehicleImageUrls]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);

      // Load profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("❌ Error loading profile:", profileError);
        // Don't clear existing data on error, just show error toast
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger le profil. Veuillez réessayer.",
        });
        return;
      }

      if (profile) {
        console.log("✅ Profile loaded successfully:", profile);
        setProfileData(profile);
        setFormData({
          fullName: profile.full_name || "",
          email: profile.email || "",
          city: profile.city || "",
        });

        // Load driver documents if user is a driver
        if (profile.is_driver_applicant) {
          console.log("🔍 Loading driver documents for user:", user.id);
          const { data: documents, error: docError } = await supabase
            .from("driver_documents")
            .select("*")
            .eq("driver_id", user.id)
            .maybeSingle();

          if (docError) {
            console.error("❌ Error loading driver documents:", docError);
          } else if (documents) {
            console.log("✅ Driver documents loaded:", documents);
            setDriverDocuments(documents);
          } else {
            console.log("⚠️ No driver documents found for user");
            setDriverDocuments(null);
          }
        }
      } else {
        console.warn("⚠️ No profile data returned");
      }
    } catch (error) {
      console.error("❌ Unexpected error loading profile:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          "Une erreur inattendue s'est produite. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La taille du fichier doit être inférieure à 5MB",
      });
      return;
    }

    try {
      setIsLoading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: fileName })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfileData((prev) => ({ ...prev, avatar_url: fileName }));

      toast({
        title: "Succès",
        description: "Photo de profil mise à jour avec succès",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de télécharger la photo de profil",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          email: formData.email,
          city: formData.city,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfileData((prev) => ({
        ...prev,
        full_name: formData.fullName,
        email: formData.email,
        city: formData.city,
      }));

      setIsEditing(false);

      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        color: "bg-green-100 text-green-800",
        icon: CheckCircle,
        text: "Approuvé",
      },
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: AlertCircle,
        text: "En attente",
      },
      rejected: { color: "bg-red-100 text-red-800", icon: X, text: "Refusé" },
      inactive: {
        color: "bg-gray-100 text-gray-800",
        icon: X,
        text: "Inactif",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const IconComponent = config.icon;

    return (
      <BadgeComponent className={`${config.color} flex items-center gap-1`}>
        <IconComponent className="w-3 h-3" />
        {config.text}
      </BadgeComponent>
    );
  };

  const getAvatarUrl = () => {
    if (!profileData.avatar_url) return null;
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(profileData.avatar_url);
    return publicUrl;
  };

  const handleVehicleImagesUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || !e.target.files.length) return;

    const files = Array.from(e.target.files);

    // Check file sizes (max 5MB each)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Chaque fichier doit faire moins de 5MB",
        });
        return;
      }
    }

    // Create preview URLs for new images
    const newUrls: string[] = [];
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      newUrls.push(url);
    });

    setNewVehicleImages((prev) => [...prev, ...files]);
    setNewVehicleImageUrls((prev) => [...prev, ...newUrls]);

    // Clear the input
    e.target.value = "";
  };

  const handleSaveVehicleImages = async () => {
    if (newVehicleImages.length === 0) {
      setIsEditingVehicleImages(false);
      return;
    }

    try {
      setVehicleImagesLoading(true);

      const uploadedUrls: string[] = [];

      for (const file of newVehicleImages) {
        const fileExt = file.name.split(".").pop();
        const fileName = `vehicle-${user.id}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("driver_documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("driver_documents").getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      // Update driver documents with new vehicle images
      const currentImages = driverDocuments?.vehicle_images || [];
      const updatedVehicleImages = [...currentImages, ...uploadedUrls];

      console.log("🔄 Updating vehicle images for driver:", user.id);
      console.log("📸 Current images:", currentImages);
      console.log("📸 New images:", uploadedUrls);
      console.log("📸 Updated images:", updatedVehicleImages);

      // Check if driver document exists
      const { data: existingDoc, error: checkError } = await supabase
        .from("driver_documents")
        .select("driver_id")
        .eq("driver_id", user.id)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error checking driver document:", checkError);
        throw checkError;
      }

      let updateError;
      if (existingDoc) {
        // Update existing record
        console.log("✅ Driver document exists, updating...");
        const { error } = await supabase
          .from("driver_documents")
          .update({
            vehicle_images: updatedVehicleImages,
            updated_at: new Date().toISOString(),
          })
          .eq("driver_id", user.id);
        updateError = error;
      } else {
        // Insert new record
        console.log("✅ Driver document does not exist, inserting...");
        const { error } = await supabase.from("driver_documents").insert({
          driver_id: user.id,
          vehicle_images: updatedVehicleImages,
          status: "pending",
          national_id_number: "",
          license_number: "",
          registration_number: "",
          insurance_number: "",
          technical_inspection_number: "",
          road_tax_number: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        updateError = error;
      }

      if (updateError) {
        console.error(
          "❌ Error updating/inserting driver document:",
          updateError
        );
        console.error("❌ Error details:", {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        throw updateError;
      }

      setDriverDocuments((prev) => {
        console.log("🔄 Updating driverDocuments state:", {
          prev,
          updatedVehicleImages,
        });
        if (prev) {
          const newState = {
            ...prev,
            vehicle_images: updatedVehicleImages,
          };
          console.log("✅ Updated existing driverDocuments:", newState);
          return newState;
        } else {
          // If no driver documents existed, create a new one
          const newState = {
            driver_id: user.id,
            vehicle_images: updatedVehicleImages,
            status: "pending",
            national_id_number: "",
            license_number: "",
            registration_number: "",
            insurance_number: "",
            technical_inspection_number: "",
            road_tax_number: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            national_id_file_recto: null,
            national_id_file_verso: null,
            license_file_recto: null,
            license_file_verso: null,
            registration_file_recto: null,
            registration_file_verso: null,
            insurance_file_recto: null,
            insurance_file_verso: null,
          };
          console.log("✅ Created new driverDocuments:", newState);
          return newState;
        }
      });

      // Clear temporary data
      setNewVehicleImages([]);
      setNewVehicleImageUrls([]);
      setIsEditingVehicleImages(false);

      toast({
        title: "Succès",
        description: `${newVehicleImages.length} photo(s) ajoutée(s) avec succès`,
      });
    } catch (error) {
      console.error("Error uploading vehicle images:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de télécharger les photos du véhicule",
      });
    } finally {
      setVehicleImagesLoading(false);
    }
  };

  const handleCancelVehicleImages = () => {
    // Clear temporary data
    setNewVehicleImages([]);
    setNewVehicleImageUrls([]);
    setIsEditingVehicleImages(false);
  };

  const handleRemoveVehicleImage = async (imageUrl: string) => {
    try {
      setVehicleImagesLoading(true);

      const currentImages = driverDocuments?.vehicle_images || [];
      const newImages = currentImages.filter((img) => img !== imageUrl);

      console.log("🗑️ Removing vehicle image:", imageUrl);
      console.log("📸 Remaining images:", newImages);

      const { error: updateError } = await supabase
        .from("driver_documents")
        .update({
          vehicle_images: newImages,
          updated_at: new Date().toISOString(),
        })
        .eq("driver_id", user.id);

      if (updateError) {
        console.error("❌ Error removing vehicle image:", updateError);
        throw updateError;
      }

      setDriverDocuments((prev) =>
        prev
          ? {
              ...prev,
              vehicle_images: newImages,
            }
          : null
      );

      toast({
        title: "Succès",
        description: "Photo supprimée avec succès",
      });
    } catch (error) {
      console.error("Error removing vehicle image:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la photo",
      });
    } finally {
      setVehicleImagesLoading(false);
    }
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Chargement du profil...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no profile data and not loading
  if (!profileData || !profileData.full_name) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Profil non trouvé</h1>
          <p className="text-muted-foreground">
            Impossible de charger les informations de votre profil.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={refreshProfile} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
            <Button onClick={() => router.push("/")}>Retour à l'accueil</Button>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {profileData.is_driver_applicant
                ? "Profil de Chauffeur"
                : "Profil Utilisateur"}
            </h1>
            <p className="text-muted-foreground mt-2">
              Gérez vos informations personnelles et vos préférences
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {profileData.is_driver_applicant &&
              profileData.driver_status === "approved" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/driver/dashboard")}
                  className="flex items-center justify-center gap-2"
                >
                  <Car className="w-4 h-4" />
                  <span className="hidden sm:inline">Tableau de bord</span>
                  <span className="sm:hidden">Tableau de bord</span>
                </Button>
              )}

            {profileData.is_driver_applicant &&
              profileData.driver_status === "pending" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/driver/pending")}
                  className="flex items-center justify-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Statut de Candidature
                  </span>
                  <span className="sm:hidden">Statut</span>
                </Button>
              )}

            {profileData.is_driver_applicant &&
              profileData.driver_status === "rejected" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/driver/pending")}
                  className="flex items-center justify-center gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Voir le Statut Refusé
                  </span>
                  <span className="sm:hidden">Statut</span>
                </Button>
              )}

            <Button
              variant="outline"
              onClick={refreshProfile}
              disabled={isLoading}
              className="flex items-center justify-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Actualiser</span>
              <span className="sm:hidden">Actualiser</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Profile Overview Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Avatar Section */}
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-lg">
                  {getAvatarUrl() ? (
                    <AvatarImage
                      src={getAvatarUrl()!}
                      alt="Photo de profil"
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary to-amber-500 text-primary-foreground text-2xl font-bold">
                      {profileData.full_name
                        ? profileData.full_name[0].toUpperCase()
                        : user?.phone?.slice(-2) || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>

                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-2 -right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
              </div>

              {/* Profile Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {profileData.full_name || "Nom non défini"}
                  </h2>
                  <p className="text-muted-foreground">
                    {profileData.email || user.phone}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {profileData.city || "Ville non définie"}
                    </span>
                  </div>

                  {profileData.is_driver_applicant && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      {getStatusBadge(profileData.driver_status)}
                    </div>
                  )}
                </div>

                {profileData.is_driver_applicant &&
                  profileData.driver_application_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Candidature soumise le{" "}
                        {format(
                          new Date(profileData.driver_application_date),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Informations Personnelles
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour vos informations de base
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2"
                >
                  {isEditing ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Edit3 className="w-4 h-4" />
                  )}
                  {isEditing ? "Annuler" : "Modifier"}
                </Button>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="fullName"
                        className="flex items-center gap-2"
                      >
                        <User className="h-4 w-4" /> Nom Complet
                      </Label>
                      <Input
                        id="fullName"
                        placeholder="Entrez votre nom complet"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            fullName: e.target.value,
                          }))
                        }
                        disabled={!isEditing || isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" /> Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Entrez votre email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        disabled={!isEditing || isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="phone"
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" /> Numéro de Téléphone
                      </Label>
                      <Input
                        id="phone"
                        value={profileData.phone || user.phone || ""}
                        disabled={true}
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Le numéro de téléphone ne peut pas être modifié car il
                        sert d'identifiant
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Ville
                      </Label>
                      <SearchableSelect
                        options={[...allCameroonCities]}
                        value={formData.city}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, city: value }))
                        }
                        placeholder="Sélectionnez votre ville"
                        searchPlaceholder="Rechercher une ville..."
                        disabled={!isEditing || isLoading}
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        disabled={isLoading}
                      >
                        Annuler
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sauvegarde...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Sauvegarder
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Driver Documents Section */}
          {profileData.is_driver_applicant && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documents de Chauffeur
                  </CardTitle>
                  <CardDescription>
                    Vos documents soumis pour la candidature de chauffeur
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-6">
                    {/* Document Images Section */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Documents Soumis
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CNI */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">
                            Carte Nationale d'Identité
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            {driverDocuments?.national_id_file_recto && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.national_id_file_recto}
                                  alt="CNI Recto"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            {driverDocuments?.national_id_file_verso && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.national_id_file_verso}
                                  alt="CNI Verso"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* License */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">
                            Permis de Conduire
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            {driverDocuments?.license_file_recto && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.license_file_recto}
                                  alt="Permis Recto"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            {driverDocuments?.license_file_verso && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.license_file_verso}
                                  alt="Permis Verso"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Registration */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Carte Grise</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {driverDocuments?.registration_file_recto && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.registration_file_recto}
                                  alt="Carte Grise Recto"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            {driverDocuments?.registration_file_verso && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.registration_file_verso}
                                  alt="Carte Grise Verso"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Insurance */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Assurance</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {driverDocuments?.insurance_file_recto && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.insurance_file_recto}
                                  alt="Assurance Recto"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            {driverDocuments?.insurance_file_verso && (
                              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                                <img
                                  src={driverDocuments.insurance_file_verso}
                                  alt="Assurance Verso"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Show message when no driver documents exist yet */}
                    {!driverDocuments && (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          Aucun document soumis pour le moment
                        </p>
                        <p className="text-xs mt-1">
                          Vous pouvez commencer par ajouter des photos de votre
                          véhicule ci-dessous
                        </p>
                      </div>
                    )}

                    {/* Vehicle Images Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                          Photos du Véhicule
                        </h4>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setIsEditingVehicleImages(!isEditingVehicleImages)
                          }
                          className="flex items-center gap-2"
                          disabled={vehicleImagesLoading}
                        >
                          {isEditingVehicleImages ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Edit3 className="w-4 h-4" />
                          )}
                          {isEditingVehicleImages ? "Annuler" : "Modifier"}
                        </Button>
                      </div>

                      {/* Always show upload interface for driver applicants */}
                      {isEditingVehicleImages && (
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Ajouter des photos
                            </Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleVehicleImagesUpload}
                                disabled={vehicleImagesLoading}
                                className="hidden"
                                id="vehicle-images-upload"
                              />
                              <label
                                htmlFor="vehicle-images-upload"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                <Camera className="w-4 h-4" />
                                Ajouter des photos
                              </label>
                              <span className="text-xs text-muted-foreground">
                                JPG, PNG, GIF, WebP (max 5MB chacun)
                              </span>
                            </div>
                          </div>

                          {/* Preview of new images */}
                          {newVehicleImageUrls.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Nouvelles photos à ajouter
                              </Label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {newVehicleImageUrls.map((url, index) => (
                                  <div
                                    key={index}
                                    className="relative aspect-square bg-muted rounded-lg overflow-hidden border"
                                  >
                                    <img
                                      src={url}
                                      alt={`Nouvelle photo ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setNewVehicleImages((prev) =>
                                          prev.filter((_, i) => i !== index)
                                        );
                                        setNewVehicleImageUrls((prev) =>
                                          prev.filter((_, i) => i !== index)
                                        );
                                      }}
                                      className="absolute top-1 right-1 w-6 h-6 p-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              onClick={handleSaveVehicleImages}
                              disabled={
                                vehicleImagesLoading ||
                                newVehicleImages.length === 0
                              }
                              className="flex items-center gap-2"
                            >
                              {vehicleImagesLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              {vehicleImagesLoading
                                ? "Sauvegarde..."
                                : "Sauvegarder"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCancelVehicleImages}
                              disabled={vehicleImagesLoading}
                            >
                              Annuler
                            </Button>
                          </div>

                          {vehicleImagesLoading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sauvegarde des photos...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show existing images or empty state */}
                      {driverDocuments?.vehicle_images &&
                      driverDocuments.vehicle_images.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {driverDocuments.vehicle_images.map(
                            (image, index) => (
                              <div
                                key={index}
                                className="relative group aspect-square bg-muted rounded-lg overflow-hidden border"
                              >
                                <img
                                  src={image}
                                  alt={`Véhicule ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />

                                {isEditingVehicleImages && (
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        handleRemoveVehicleImage(image)
                                      }
                                      disabled={vehicleImagesLoading}
                                      className="flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" />
                                      Supprimer
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Aucune photo de véhicule</p>
                          {!isEditingVehicleImages && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingVehicleImages(true)}
                              className="mt-2"
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Ajouter des photos
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className="w-5 h-5" />
                  Statut du Compte
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Type de compte:
                    </span>
                    <BadgeComponent variant="outline">
                      {profileData.is_driver_applicant
                        ? "Chauffeur"
                        : "Utilisateur"}
                    </BadgeComponent>
                  </div>

                  {profileData.is_driver_applicant && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Statut chauffeur:
                      </span>
                      {getStatusBadge(profileData.driver_status)}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rôle:</span>
                    <BadgeComponent variant="outline">
                      {profileData.role === "admin"
                        ? "Administrateur"
                        : profileData.role === "driver"
                        ? "Chauffeur"
                        : "Utilisateur"}
                    </BadgeComponent>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Membre depuis:
                    </span>
                    <span>
                      {profileData.created_at
                        ? format(new Date(profileData.created_at), "MMM yyyy", {
                            locale: fr,
                          })
                        : "Non disponible"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Dernière mise à jour:
                    </span>
                    <span>
                      {profileData.updated_at
                        ? format(
                            new Date(profileData.updated_at),
                            "dd/MM/yyyy",
                            { locale: fr }
                          )
                        : "Non disponible"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Actions Rapides
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {!profileData.is_driver_applicant && (
                  <Button
                    onClick={() => router.push("/become-driver")}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Car className="w-4 h-4 mr-2" />
                    Devenir Chauffeur
                  </Button>
                )}

                {profileData.is_driver_applicant &&
                  profileData.driver_status === "approved" && (
                    <Button
                      onClick={() => router.push("/driver/rides/new")}
                      className="w-full justify-start"
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Publier un Trajet
                    </Button>
                  )}

                {profileData.is_driver_applicant &&
                  profileData.driver_status === "pending" && (
                    <Button
                      onClick={() => router.push("/driver/pending")}
                      className="w-full justify-start"
                      variant="outline"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Voir le Statut
                    </Button>
                  )}

                <Button
                  onClick={() => router.push("/rides")}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Voir les Trajets
                </Button>

                <Button
                  onClick={() => router.push("/bookings")}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Mes Réservations
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
