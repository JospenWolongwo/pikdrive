"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useSupabase } from "@/providers/SupabaseProvider";
import { motion } from "framer-motion";
import { Phone, ArrowRight, Lock, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user) {
      const redirectTo = searchParams.get("redirectTo") || "/";
      router.push(redirectTo);
    }
  }, [user, loading, router, searchParams]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Vérification de l'authentification...</span>
        </div>
      </div>
    );
  }

  // Don't render auth form if user is authenticated
  if (user) {
    return null;
  }

  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState("");
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Get auth actions from Supabase client directly
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for saved phone number
    const lastPhone = localStorage.getItem("lastPhoneNumber");
    if (lastPhone) {
      setSavedPhone(lastPhone);
    }
  }, []);

  const formatPhoneNumber = (phone: string) => {
    return phone.startsWith("+") ? phone : `+237${phone.replace(/^237/, "")}`;
  };

  const maskPhoneNumber = (phone: string) => {
    const formatted = formatPhoneNumber(phone);
    return `****${formatted.slice(-4)}`;
  };

  const handleContinue = async () => {
    setError("");

    if (!phone && !savedPhone) {
      setError("Veuillez entrer votre numéro de téléphone");
      return;
    }

    setIsLoading(true);
    try {
      const phoneToUse = phone || savedPhone || "";
      const formattedPhone = formatPhoneNumber(phoneToUse);

      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: "sms",
        },
      });
      if (signInError) throw new Error(signInError.message);

      // Save phone number for future use
      localStorage.setItem("lastPhoneNumber", formattedPhone);

      setShowVerification(true);
      toast({
        title: "Code envoyé !",
        description:
          "Veuillez consulter votre téléphone pour le code de vérification",
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");

    if (!code) {
      setError("Veuillez entrer le code de vérification");
      return;
    }

    setIsLoading(true);
    try {
      const phoneToUse = phone || savedPhone || "";
      const formattedPhone = formatPhoneNumber(phoneToUse);

      const { error: verifyError, data } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: "sms",
      });
      if (verifyError) throw new Error(verifyError.message);

      if (!data?.user) {
        throw new Error("Verification successful but no user returned");
      }

      // Reset resend cooldown on successful verification
      setResendCooldown(0);

      toast({
        title: "Bienvenue !",
        description: "Vous vous êtes connecté avec succès",
      });

      // Ensure long-lived session by forcing a refresh cycle once after sign-in
      // This obtains a fresh access token and sets long-lived cookies
      try {
        await supabase.auth.refreshSession();
      } catch (_) {}

      // Ensure session cookies are persisted before navigating
      // Retry briefly until session is available to avoid immediate redirect loops
      let attempts = 0;
      let sessionUser = data.user;
      while (!sessionUser && attempts < 8) {
        await new Promise((r) => setTimeout(r, 150));
        const { data: sessionData } = await supabase.auth.getSession();
        sessionUser = sessionData.session?.user as any;
        attempts += 1;
      }

      const redirectTo = searchParams.get("redirectTo");
      // Use hard navigation to ensure cookies are sent on first protected route load
      if (typeof window !== "undefined") {
        window.location.assign(redirectTo || "/");
      } else {
        router.replace(redirectTo || "/");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setError("");

    try {
      const phoneToUse = phone || savedPhone || "";
      if (!phoneToUse) {
        setError("Numéro de téléphone non trouvé");
        return;
      }

      const formattedPhone = formatPhoneNumber(phoneToUse);
      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: "sms",
        },
      });

      if (signInError) throw new Error(signInError.message);

      // Set cooldown for 60 seconds
      setResendCooldown(60);

      toast({
        title: "Code renvoyé !",
        description:
          "Un nouveau code de vérification a été envoyé à votre téléphone",
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsResending(false);
    }
  };

  // Handle cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 p-6 bg-card rounded-lg border shadow-sm"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue sur PikDrive
          </h1>
          <p className="text-muted-foreground">
            {showVerification
              ? "Entrez le code de vérification envoyé à votre téléphone"
              : savedPhone
              ? "Content de vous revoir ! Envoyons-nous un code à votre téléphone ?"
              : "Entrez votre numéro de téléphone pour continuer"}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {!showVerification && !savedPhone && (
            <div className="space-y-2">
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Entrez votre numéro de téléphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9"
                  type="tel"
                />
              </div>
            </div>
          )}

          {!showVerification && savedPhone && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">
                Envoyer le code au {maskPhoneNumber(savedPhone)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full text-xs sm:text-sm"
                  onClick={() => setSavedPhone(null)}
                >
                  Utiliser un autre numéro
                </Button>
                <Button
                  className="w-full"
                  onClick={handleContinue}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Envoyer le code"
                  )}
                </Button>
              </div>
            </div>
          )}

          {showVerification && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Code envoyé au {maskPhoneNumber(phone || savedPhone || "")}
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Entrez le code de vérification"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="pl-9"
                    type="number"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleVerify}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Vérifier"
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : resendCooldown > 0 ? (
                    `Renvoyer dans ${resendCooldown}s`
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Renvoyer le code
                    </>
                  )}
                </Button>

                {resendCooldown > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Attendez un moment avant de demander un nouveau code
                  </p>
                )}
              </div>
            </div>
          )}

          {!showVerification && !savedPhone && (
            <Button
              className="w-full"
              onClick={handleContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
