"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileIcon, ImageIcon, FileTextIcon, ExternalLinkIcon, DownloadIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DocumentViewerProps {
  documents: {
    national_id_number: string
    license_number: string
    registration_number: string
    insurance_number: string
    technical_inspection_number: string
    national_id_file: string
    license_file: string
    registration_file: string
    insurance_file: string
    technical_inspection_file: string
    vehicle_images: string[]
  }
}

export default function DocumentViewer({ documents }: DocumentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const documentTypes = [
    { 
      id: "national-id", 
      label: "National ID", 
      number: documents.national_id_number,
      file: documents.national_id_file 
    },
    { 
      id: "license", 
      label: "Driver's License", 
      number: documents.license_number,
      file: documents.license_file 
    },
    { 
      id: "registration", 
      label: "Vehicle Registration", 
      number: documents.registration_number,
      file: documents.registration_file 
    },
    { 
      id: "insurance", 
      label: "Insurance Certificate", 
      number: documents.insurance_number,
      file: documents.insurance_file 
    },
    { 
      id: "technical-inspection", 
      label: "Technical Inspection", 
      number: documents.technical_inspection_number,
      file: documents.technical_inspection_file 
    }
  ]

  const getFileExtension = (url: string) => {
    try {
      const extension = url.split('.').pop()?.toLowerCase() || ''
      return extension === 'pdf' ? 'pdf' : 'image'
    } catch (error) {
      return 'unknown'
    }
  }

  // Helper function to build the complete Supabase storage URL if needed
  const getCompleteFileUrl = (url: string) => {
    if (!url) return '';
    
    // If already a complete URL (starts with http or https), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Get the Supabase URL from environment or use a default
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://etxmevlhgtnrrgshpfdo.supabase.co';
    
    // Construct the storage URL - documents are stored in the driver_documents bucket
    return `${supabaseUrl}/storage/v1/object/public/driver_documents/${url}`;
  };

  const renderFilePreview = (url: string) => {
    // Ensure we have a complete URL
    const fullUrl = getCompleteFileUrl(url);
    console.log("Document URL:", { original: url, full: fullUrl });
    
    const fileType = getFileExtension(fullUrl);
    
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
    
    if (fileType === 'pdf') {
      return (
        <div className="flex flex-col items-center justify-center p-4 border rounded-md bg-gray-50 h-64 w-full">
          <FileTextIcon className="w-16 h-16 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">PDF Document</p>
          <div className="flex gap-2 mt-4">
            <a 
              href={fullUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-white rounded-md"
            >
              <ExternalLinkIcon className="w-4 h-4" />
              Open
            </a>
            <a 
              href={fullUrl} 
              download
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md"
            >
              <DownloadIcon className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      )
    }
    
    return (
      <div className="relative h-64 w-full border rounded-md overflow-hidden bg-gray-100">
        <Image
          src={fullUrl}
          alt="Document preview"
          fill
          className="object-contain cursor-pointer"
          onClick={() => setSelectedImage(fullUrl)}
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized // Added to prevent image optimization issues with dynamic URLs
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="documents">
        <TabsList className="mb-4">
          <TabsTrigger value="documents">Required Documents</TabsTrigger>
          <TabsTrigger value="vehicle-images">Vehicle Images ({documents.vehicle_images?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="documents">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documentTypes.map((doc) => (
              <Card key={doc.id} className="overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-800">{doc.label}</h3>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Number:</span> {doc.number}
                    </p>
                  </div>
                  <Badge variant={doc.file ? "default" : "destructive"}>
                    {doc.file ? "Provided" : "Missing"}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  {doc.file ? (
                    renderFilePreview(doc.file)
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-50 border border-dashed rounded-md">
                      <div className="text-center text-gray-500">
                        <FileIcon className="w-12 h-12 mx-auto text-gray-300" />
                        <p className="mt-2">Document not provided</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="vehicle-images">
          {documents.vehicle_images && documents.vehicle_images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.vehicle_images.map((url, index) => {
                const fullImageUrl = getCompleteFileUrl(url);
                console.log(`Vehicle image ${index + 1}:`, { original: url, full: fullImageUrl });
                
                return (
                  <Card key={index} className="overflow-hidden">
                    <div className="relative h-48 w-full border-b bg-gray-100">
                      <Image
                        src={fullImageUrl}
                        alt={`Vehicle image ${index + 1}`}
                        fill
                        className="object-cover cursor-pointer"
                        onClick={() => setSelectedImage(fullImageUrl)}
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized
                      />
                    </div>
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Image {index + 1}</span>
                        <a 
                          href={fullImageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLinkIcon className="h-3 w-3" />
                          View Full Size
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-gray-50 border border-dashed rounded-md">
              <div className="text-center text-gray-500">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-300" />
                <p className="mt-2">No vehicle images provided</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Large image viewer dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
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
            <Button 
              variant="outline" 
              onClick={() => setSelectedImage(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
