"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { supabase } = useSupabase()

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth")
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profile?.role !== "admin") {
          router.push("/")
        }
      } catch (error) {
        console.error("Error checking admin access:", error)
        router.push("/")
      }
    }

    checkAdminAccess()
  }, [])

  return (
    <div>
      {children}
    </div>
  )
}
