"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the confirmation page
    router.replace("/become-driver/confirmation")
  }, [router])

  return (
    <div className="container py-16 flex flex-col items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-gray-600">Please wait while we redirect you to the confirmation page.</p>
      </div>
    </div>
  )
} 