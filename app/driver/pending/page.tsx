"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, ShieldCheck } from "lucide-react"

export default function PendingPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()

  useEffect(() => {
    if (!user) {
      router.push("/auth")
      return
    }

    const checkStatus = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_driver, driver_status")
        .eq("id", user.id)
        .single()

      if (error) {
        console.error("Error checking driver status:", error)
        return
      }

      if (!data.is_driver) {
        router.push("/become-driver")
        return
      }

      if (data.driver_status === "approved") {
        router.push("/driver/dashboard")
      }
    }

    checkStatus()

    // Subscribe to profile changes
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          checkStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, router, supabase])

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Application Under Review</h1>
            <p className="text-muted-foreground">
              Your driver application is currently being reviewed by our team.
              We'll notify you once it's approved.
            </p>
          </div>

          <div className="grid gap-4 max-w-lg mx-auto">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="font-medium">Documents Submitted</div>
                <div className="text-sm text-muted-foreground">
                  All required documents have been received
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="font-medium">Verification in Progress</div>
                <div className="text-sm text-muted-foreground">
                  We're verifying your documents and background
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button variant="outline" onClick={() => router.push("/")}>
              Return to Home
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
