import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { toast } from "@/components/ui";

interface UseAdminAccessOptions {
  showToast?: boolean;
  redirectOnFail?: boolean;
}

export function useAdminAccess(options: UseAdminAccessOptions = {}) {
  const { showToast = true, redirectOnFail = true } = options;
  const { supabase } = useSupabase();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAdminAccess = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      
      if (!currentUser) {
        if (redirectOnFail) {
          router.push("/auth");
        }
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();

      if (profile?.role !== "admin") {
        if (showToast) {
          toast({
            title: "Accès Refusé",
            description: "Vous n'avez pas la permission d'accéder à cette page.",
            variant: "destructive",
          });
        }
        if (redirectOnFail) {
          router.push("/");
        }
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      if (redirectOnFail) {
        router.push("/");
      }
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, showToast, redirectOnFail]);

  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  return { isAdmin, loading, checkAdminAccess };
}

