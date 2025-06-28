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
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Driver Information</CardTitle>
                  <CardDescription className="text-xs">Personal details and contact information</CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs">
                  ID: {driver.id?.substring(0, 8)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 pb-5 border-b">
                <Avatar className="h-16 w-16 border shadow-sm">
                  <AvatarImage src={driver.avatar_url} alt={driver.full_name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 text-lg font-medium">
                    {driver.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-base font-semibold mb-1">{driver.full_name}</h3>
                  <div className="flex items-center text-xs text-slate-500">
                    <div className="bg-slate-100 rounded-full p-1 mr-1.5">
                      <MapPinIcon className="h-3 w-3" />
                    </div>
                    {driver.city || "No location provided"}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="flex flex-col bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="inline-flex items-center mb-1.5">
                    <div className="bg-blue-100 rounded-full p-1.5 mr-2">
                      <MailIcon className="h-4 w-4 text-blue-700" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Email</span>
                  </div>
                  <span className="text-sm truncate" title={driver.email}>{driver.email}</span>
                </div>
                
                <div className="flex flex-col bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="inline-flex items-center mb-1.5">
                    <div className="bg-green-100 rounded-full p-1.5 mr-2">
                      <PhoneIcon className="h-4 w-4 text-green-700" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Phone</span>
                  </div>
                  <span className="text-sm">{driver.phone || "No phone provided"}</span>
                </div>
                
                <div className="flex flex-col bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="inline-flex items-center mb-1.5">
                    <div className="bg-amber-100 rounded-full p-1.5 mr-2">
                      <CalendarIcon className="h-4 w-4 text-amber-700" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">Registered</span>
                  </div>
                  <span className="text-sm">{formatDate(driver.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Document viewer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Documents & Vehicle Images</CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>Review uploaded documents and vehicle images</span>
                {driver.documents && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    ID: {driver.documents.id?.substring(0, 8)}
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {driver.documents ? (
                <>
                  {console.log('Debug - Documents being sent to viewer:', JSON.stringify(driver.documents, null, 2))}
                  <DocumentViewer documents={driver.documents} />
                </>
              ) : (
                <div className="p-8 text-center border border-dashed rounded-md bg-slate-50">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <path d="M13 2v7h7"></path>
                    </svg>
                  </div>
                  <p className="font-medium text-slate-600">No documents available</p>
                  <p className="text-xs text-slate-400 mt-1">This driver has not uploaded any documents yet</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleApprove}
                    className="gap-2 w-full h-10"
                    disabled={isProcessing}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    <span className="whitespace-nowrap">Approve</span>
                  </Button>
                  <Button 
                    onClick={handleReject}
                    variant="destructive" 
                    className="gap-2 w-full h-10"
                    disabled={isProcessing}
                  >
                    <XCircleIcon className="h-4 w-4" />
                    <span className="whitespace-nowrap">Reject</span>
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
