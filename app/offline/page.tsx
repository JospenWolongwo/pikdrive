import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">You're Offline</h1>
        <p className="text-gray-600">
          Please check your internet connection and try again
        </p>
        <Button asChild>
          <Link href="/">Try Again</Link>
        </Button>
      </div>
    </div>
  )
}
