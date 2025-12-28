"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileIcon,
  ZoomInIcon,
} from "lucide-react";

interface PassengerDocumentViewerProps {
  documents: {
    full_name: string;
    national_id_file_recto: string;
    national_id_file_verso: string;
  };
}

export default function PassengerDocumentViewer({ documents }: PassengerDocumentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const getCompleteFileUrl = (url: string | null): string => {
    if (!url) return "";
    
    // URLs are already complete from storage
    if (url.startsWith("http")) {
      return url;
    }

    // Fallback for relative paths
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    return `${supabaseUrl}/storage/v1/object/public/${url}`;
  };

  const renderFilePreview = (url: string, label: string) => {
    const fullUrl = getCompleteFileUrl(url);

    if (!fullUrl) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 border border-dashed rounded-md">
          <div className="text-center text-gray-500">
            <FileIcon className="w-12 h-12 mx-auto text-gray-300" />
            <p className="mt-2">Invalid document URL</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-64 w-full border rounded-md overflow-hidden bg-gray-100 shadow-inner group">
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity z-10">
          <Button
            variant="secondary"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shadow-md"
            onClick={() => setSelectedImage(fullUrl)}
          >
            <ZoomInIcon className="w-4 h-4" /> View Larger
          </Button>
        </div>
        <Image
          src={fullUrl}
          alt={label}
          fill
          className="object-contain cursor-pointer z-0"
          onClick={() => setSelectedImage(fullUrl)}
          sizes="100vw"
          unoptimized
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border w-full">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b px-5 py-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-semibold text-sm">
                Carte d'Identité Nationale
              </CardTitle>
              <CardDescription className="text-xs mt-1.5 flex items-center">
                <span className="font-medium">Nom:</span>
                <span className="ml-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                  {documents.full_name}
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Badge
                variant={documents.national_id_file_recto ? "default" : "destructive"}
                className={`text-xs px-2 py-0.5 ${
                  documents.national_id_file_recto
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : ""
                }`}
              >
                Recto: {documents.national_id_file_recto ? "✓" : "✗"}
              </Badge>
              <Badge
                variant={documents.national_id_file_verso ? "default" : "destructive"}
                className={`text-xs px-2 py-0.5 ${
                  documents.national_id_file_verso
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : ""
                }`}
              >
                Verso: {documents.national_id_file_verso ? "✓" : "✗"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-white w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Recto (Front) */}
            <div className="w-full">
              <h4 className="text-sm font-medium mb-2 text-gray-700">
                Recto (Avant)
              </h4>
              {documents.national_id_file_recto ? (
                renderFilePreview(documents.national_id_file_recto, "CNI Recto")
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted/50 border border-dashed rounded-md">
                  <div className="text-center text-muted-foreground">
                    <FileIcon className="w-6 h-6 mx-auto text-muted-foreground/60" />
                    <p className="text-xs mt-1">
                      Recto non fourni
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Verso (Back) */}
            <div className="w-full">
              <h4 className="text-sm font-medium mb-2 text-gray-700">
                Verso (Arrière)
              </h4>
              {documents.national_id_file_verso ? (
                renderFilePreview(documents.national_id_file_verso, "CNI Verso")
              ) : (
                <div className="flex items-center justify-center h-48 bg-muted/50 border border-dashed rounded-md">
                  <div className="text-center text-muted-foreground">
                    <FileIcon className="w-6 h-6 mx-auto text-muted-foreground/60" />
                    <p className="text-xs mt-1">
                      Verso non fourni
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Large image viewer dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          <div className="relative h-[70vh] w-full">
            {selectedImage && (
              <Image
                src={getCompleteFileUrl(selectedImage)}
                alt="Document preview"
                fill
                className="object-contain"
                sizes="90vw"
                unoptimized
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelectedImage(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

