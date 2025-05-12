"use client"

import { useState } from "react"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent 
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarIcon, MapPinIcon, PhoneIcon, MailIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import DocumentViewer from "./document-viewer"
import { formatDistanceToNow } from "date-fns"

interface DriverDetailProps {
  open: boolean
  onClose: () => void
  driver: any
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export default function DriverDetail({ 
  open, 
  onClose, 
  driver, 
  onApprove, 
  onReject 
}: DriverDetailProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case "approved": return "bg-green-100 text-green-800"
      case "rejected": return "bg-red-100 text-red-800"
      case "pending": return "bg-amber-100 text-amber-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    await onApprove(driver.id)
    setIsProcessing(false)
  }

  const handleReject = async () => {
    setIsProcessing(true)
    await onReject(driver.id)
    setIsProcessing(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (!driver) return null

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full max-w-4xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl flex items-center justify-between">
            <span>Driver Application</span>
            <Badge className={getStatusColor(driver.driver_status)}>
              {driver.driver_status.toUpperCase()}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Submitted {driver.created_at ? formatDistanceToNow(new Date(driver.created_at), { addSuffix: true }) : "recently"}
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6">
          {/* Driver profile card */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Information</CardTitle>
              <CardDescription>Personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={driver.avatar_url} alt={driver.full_name} />
                  <AvatarFallback>{driver.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{driver.full_name}</h3>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPinIcon className="mr-1 h-4 w-4" />
                    {driver.city || "No location provided"}
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <MailIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{driver.email}</span>
                </div>
                <div className="flex items-center">
                  <PhoneIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{driver.phone || "No phone provided"}</span>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Registered: {formatDate(driver.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Document viewer */}
          <Card>
            <CardHeader>
              <CardTitle>Documents & Vehicle Images</CardTitle>
              <CardDescription>Review uploaded documents and vehicle images</CardDescription>
            </CardHeader>
            <CardContent>
              {driver.documents ? (
                <DocumentViewer documents={driver.documents} />
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No documents available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Admin actions */}
          {driver.driver_status === "pending" && (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle>Application Decision</CardTitle>
                <CardDescription>Approve or reject this driver application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={handleApprove}
                    className="flex-1 gap-2"
                    disabled={isProcessing}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Approve Application
                  </Button>
                  <Button 
                    onClick={handleReject}
                    variant="destructive" 
                    className="flex-1 gap-2"
                    disabled={isProcessing}
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Reject Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
