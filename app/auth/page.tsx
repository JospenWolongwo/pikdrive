"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Phone, ArrowRight, Lock, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthPage() {
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
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState("");
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const { signIn, verifyOTP } = useAuth();
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

      const { error: signInError } = await signIn(formattedPhone);
      if (signInError) throw new Error(signInError);

      // Save phone number for future use
      localStorage.setItem("lastPhoneNumber", formattedPhone);

      setShowVerification(true);
      toast({
        title: "Code envoyé !",
        description: "Veuillez consulter votre téléphone pour le code de vérification",
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

      const { error: verifyError, data } = await verifyOTP(
        formattedPhone,
        code
      );
      if (verifyError) throw new Error(verifyError);

      if (!data?.user) {
        throw new Error("Verification successful but no user returned");
      }

      toast({
        title: "Bienvenue !",
        description: "Vous vous êtes connecté avec succès",
      });

      const redirectTo = searchParams.get("redirectTo");
      router.push(redirectTo || "/");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
                  className="w-full"
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

          {showVerification && (
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
          )}
        </div>
      </motion.div>
    </div>
  );
}
