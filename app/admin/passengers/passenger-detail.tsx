"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui";
import {
  CalendarIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
} from "lucide-react";
import PassengerDocumentViewer from "./document-viewer";
import { formatDistanceToNow } from "date-fns";

interface PassengerDetailProps {
  open: boolean;
  onClose: () => void;
  passenger: any;
}

export default function PassengerDetail({
  open,
  onClose,
  passenger,
}: PassengerDetailProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!passenger) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-[95vw] max-w-none overflow-y-auto p-0 sm:w-[90vw] sm:max-w-none md:w-[85vw] md:max-w-none lg:w-[80vw] lg:max-w-none xl:w-[75vw] xl:max-w-none"
        style={{ maxWidth: "none" }}
      >
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl flex items-center justify-between">
              <span>Passenger Information</span>
              <Badge className="bg-primary/20 border-primary text-primary text-xs font-medium">
                ID: {passenger.id?.substring(0, 8)}
              </Badge>
            </SheetTitle>
            <SheetDescription>
              Registered{" "}
              {passenger.created_at
                ? formatDistanceToNow(new Date(passenger.created_at), {
                    addSuffix: true,
                  })
                : "recently"}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 w-full px-6 pb-6">
            {/* Passenger profile card */}
            <Card className="w-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Passenger Information
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Personal details and contact information
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="w-full">
                <div className="flex items-center space-x-4 pb-5 border-b w-full">
                  <Avatar className="h-16 w-16 border shadow-sm">
                    <AvatarImage
                      src={passenger.avatar_url}
                      alt={passenger.full_name}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium text-lg">
                      {passenger.full_name
                        ? passenger.full_name.charAt(0).toUpperCase()
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {passenger.full_name || "Unknown Passenger"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Passenger since{" "}
                      {passenger.created_at
                        ? formatDate(passenger.created_at)
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                        <MailIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Email
                        </p>
                        <p className="text-sm font-medium">
                          {passenger.email || "Not provided"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                        <PhoneIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Phone
                        </p>
                        <p className="text-sm font-medium">
                          {passenger.phone || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                        <MapPinIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          City
                        </p>
                        <p className="text-sm font-medium">
                          {passenger.city || "Not provided"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="bg-primary/10 rounded-full p-2 mt-0.5">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Registered
                        </p>
                        <span className="text-sm">
                          {passenger.created_at
                            ? formatDate(passenger.created_at)
                            : "Date not available"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document viewer */}
            <Card className="w-full">
              <CardHeader className="pb-3">
                <CardTitle>Identification Documents</CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Review uploaded identification documents</span>
                  {passenger.documents && (
                    <Badge
                      variant="outline"
                      className="bg-primary/20 text-primary border-primary/20 text-xs"
                    >
                      ID: {passenger.documents.id?.substring(0, 8)}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="w-full max-w-none">
                {passenger.documents ? (
                  <div className="w-full">
                    <PassengerDocumentViewer documents={passenger.documents} />
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed rounded-md bg-slate-50">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-slate-400"
                      >
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <path d="M13 2v7h7"></path>
                      </svg>
                    </div>
                    <p className="font-medium text-slate-600">
                      No documents available
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      This passenger has not uploaded any documents yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

