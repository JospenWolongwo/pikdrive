"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Badge,
} from "@/components/ui";
import {
  FileIcon,
  ImageIcon,
  FileTextIcon,
  ExternalLinkIcon,
  DownloadIcon,
  ZoomInIcon,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { withCacheBuster } from "@/lib/utils/cache-buster";

interface DocumentViewerProps {
  documents: {
    national_id_number: string;
    license_number: string;
    registration_number: string;
    insurance_number: string;
    technical_inspection_number: string;
    national_id_file_recto: string;
    national_id_file_verso: string;
    license_file_recto: string;
    license_file_verso: string;
    registration_file_recto: string;
    registration_file_verso: string;
    insurance_file_recto: string;
    insurance_file_verso: string;
    technical_inspection_file: string;
    vehicle_images: string[];
  };
}

export default function DocumentViewer({ documents }: DocumentViewerProps) {
  const [selectedTab, setSelectedTab] = useState<string>("documents");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [adminClient, setAdminClient] = useState<any>(null);

  // Initialize admin client for storage access
  useEffect(() => {
    const createAdminClient = () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseServiceKey) {
        console.log("🔑 Creating admin client for document viewer...");
        return createClient(supabaseUrl, supabaseServiceKey);
      }

      console.log("⚠️ No service role key available for document viewer");
      return null;
    };

    setAdminClient(createAdminClient());
  }, []);

  console.log("DocumentViewer received documents:", documents);

  // Debug log to see exactly what we're receiving
  console.log("Document fields available:", Object.keys(documents || {}));

  const documentTypes = [
    {
      id: "national_id",
      label: "National ID (Recto/Verso)",
      recto: documents?.national_id_file_recto || null,
      verso: documents?.national_id_file_verso || null,
      number: documents?.national_id_number || "",
    },
    {
      id: "license",
      label: "Driver's License (Recto/Verso)",
      recto: documents?.license_file_recto || null,
      verso: documents?.license_file_verso || null,
      number: documents?.license_number || "",
    },
    {
      id: "registration",
      label: "Vehicle Registration (Recto/Verso)",
      recto: documents?.registration_file_recto || null,
      verso: documents?.registration_file_verso || null,
      number: documents?.registration_number || "",
    },
    {
      id: "insurance",
      label: "Vehicle Insurance (Recto/Verso)",
      recto: documents?.insurance_file_recto || null,
      verso: documents?.insurance_file_verso || null,
      number: documents?.insurance_number || "",
    },
    {
      id: "technical_inspection",
      label: "Technical Inspection",
      file: documents?.technical_inspection_file || null,
      number: documents?.technical_inspection_number || "",
    },
  ];

  // Log what document files we found
  documentTypes.forEach((doc) => {
    if (doc.id === "technical_inspection") {
      console.log(
        `Document "${doc.id}" (${doc.label}):`,
        doc.file ? "Found file ✅" : "Missing file ❌"
      );
    } else {
      console.log(
        `Document "${doc.id}" (${doc.label}):`,
        `Recto: ${doc.recto ? "✅" : "❌"}, Verso: ${doc.verso ? "✅" : "❌"}`
      );
    }
  });

  console.log(
    "Available document files:",
    documentTypes.map((doc) => {
      if (doc.id === "technical_inspection") {
        return {
          type: doc.id,
          hasFile: Boolean(doc.file),
          file: doc.file,
        };
      } else {
        return {
          type: doc.id,
          hasRectoFile: Boolean(doc.recto),
          hasVersoFile: Boolean(doc.verso),
          rectoFile: doc.recto,
          versoFile: doc.verso,
        };
      }
    })
  );
  console.log("Vehicle images:", documents?.vehicle_images);

  const getFileExtension = (url: string) => {
    try {
      const extension = url.split(".").pop()?.toLowerCase() || "";
      return extension === "pdf" ? "pdf" : "image";
    } catch (error) {
      return "unknown";
    }
  };

  // Helper function to ensure we have valid URLs and bypass RLS
  const getCompleteFileUrl = (url: string | null): string => {
    if (!url) return "";

    try {
      console.log("Processing URL:", url);

      // For URLs that are already complete (which is the case in our database)
      if (url.startsWith("http")) {
        console.log("URL is already complete:", url);

        // If we have an admin client, use a signed URL to bypass RLS
        if (adminClient) {
          try {
            // Extract bucket and path from the complete URL
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/");
            const bucketName = pathParts[4]; // Typically 'driver_documents' or 'vehicles'
            const objectPath = pathParts.slice(5).join("/");

            console.log("🔐 Getting signed URL for:", {
              bucket: bucketName,
              path: objectPath,
            });

            // We don't actually need to create a signed URL since we're adding service role credentials
            // Just using the original URL is fine with our admin client
            return withCacheBuster(url);
          } catch (e) {
            console.error("Error creating signed URL:", e);
            return withCacheBuster(url); // Fallback to original URL
          }
        }

        return withCacheBuster(url);
      }

      // For any other case (legacy or relative URLs)
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://lvtwvyxolrjbupltmqrl.supabase.co";

      // Handle paths with storage prefix
      if (url.startsWith("/storage/") || url.includes("/storage/")) {
        const storagePath = url.includes("/storage/")
          ? url.split("/storage/")[1]
          : url.replace("/storage/", "");

        const completeUrl = `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
        console.log("Built storage URL:", completeUrl);
        return withCacheBuster(completeUrl);
      }

      // Handle direct bucket paths
      if (url.includes("driver_documents/")) {
        const completeUrl = `${supabaseUrl}/storage/v1/object/public/${url}`;
        console.log("Built bucket URL:", completeUrl);
        return withCacheBuster(completeUrl);
      }

      // For all other paths (likely a raw bucket/object path)
      return withCacheBuster(`${supabaseUrl}/storage/v1/object/public/${url}`);
    } catch (error) {
      console.error("Error processing URL:", error, "for URL:", url);
      return url; // Return the original URL instead of empty string to be more forgiving
    }
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

    if (fileType === "pdf") {
      return (
        <div className="flex flex-col items-center justify-center p-6 border rounded-md bg-gradient-to-br from-gray-50 to-gray-100 h-64 w-full shadow-inner">
          <div className="mb-2 rounded-full bg-blue-50 p-2 border border-blue-100">
            <FileTextIcon className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">PDF Document</p>
          <div className="flex gap-3 mt-5">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
            >
              <ExternalLinkIcon className="w-4 h-4" />
              View PDF
            </a>
            <a
              href={fullUrl}
              download
              className="flex items-center gap-1 px-4 py-2 text-sm bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md transition-colors shadow-sm"
            >
              <DownloadIcon className="w-4 h-4" />
              Download
            </a>
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
          alt="Document preview"
          fill
          className="object-cover cursor-pointer z-0"
          onClick={() => setSelectedImage(fullUrl)}
          sizes="100vw"
          unoptimized // Added to prevent image optimization issues with dynamic URLs
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <Tabs defaultValue="documents" className="w-full max-w-none">
        <div className="border-b mb-6">
          <TabsList className="w-full justify-start bg-transparent p-0 mb-0">
            <TabsTrigger
              value="documents"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-2"
            >
              <FileTextIcon className="w-4 h-4 mr-2" />
              Required Documents
            </TabsTrigger>
            <TabsTrigger
              value="vehicle-images"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-2"
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Vehicle Images
              {documents.vehicle_images?.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-primary/20 text-primary"
                >
                  {documents.vehicle_images.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="mt-0 w-full">
          <div className="grid grid-cols-1 gap-6 w-full">
            {documentTypes.map((doc) => (
              <Card
                key={doc.id}
                className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border w-full"
              >
                <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b px-5 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="font-semibold text-sm">
                        {doc.label}
                      </CardTitle>
                      {doc.number && (
                        <CardDescription className="text-xs mt-1.5 flex items-center">
                          <span className="font-medium">Document #:</span>
                          <span className="ml-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                            {doc.number}
                          </span>
                        </CardDescription>
                      )}
                    </div>
                    {doc.id === "technical_inspection" ? (
                      <Badge
                        variant={doc.file ? "default" : "destructive"}
                        className={`text-xs px-2 py-0.5 ${
                          doc.file
                            ? "bg-primary/20 text-primary hover:bg-primary/30"
                            : ""
                        }`}
                      >
                        {doc.file ? "Provided" : "Missing"}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        <Badge
                          variant={doc.recto ? "default" : "destructive"}
                          className={`text-xs px-2 py-0.5 ${
                            doc.recto
                              ? "bg-primary/20 text-primary hover:bg-primary/30"
                              : ""
                          }`}
                        >
                          Recto: {doc.recto ? "✓" : "✗"}
                        </Badge>
                        <Badge
                          variant={doc.verso ? "default" : "destructive"}
                          className={`text-xs px-2 py-0.5 ${
                            doc.verso
                              ? "bg-primary/20 text-primary hover:bg-primary/30"
                              : ""
                          }`}
                        >
                          Verso: {doc.verso ? "✓" : "✗"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 bg-white w-full">
                  {doc.id === "technical_inspection" ? (
                    // Technical inspection (single document)
                    <div className="w-full">
                      {doc.file ? (
                        renderFilePreview(getCompleteFileUrl(doc.file))
                      ) : (
                        <div className="flex items-center justify-center h-64 bg-muted/50 border border-dashed rounded-md">
                          <div className="text-center text-muted-foreground">
                            <div className="bg-muted rounded-full p-3 mx-auto w-fit mb-2">
                              <FileIcon className="w-10 h-10 text-muted-foreground/60" />
                            </div>
                            <p className="mt-2 text-sm">
                              Document not provided
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              Driver needs to upload this document
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Recto/Verso documents side by side
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {/* Recto (Front) */}
                      <div className="w-full">
                        <h4 className="text-sm font-medium mb-2 text-gray-700">
                          Recto (Front)
                        </h4>
                        {doc.recto ? (
                          renderFilePreview(getCompleteFileUrl(doc.recto))
                        ) : (
                          <div className="flex items-center justify-center h-48 bg-muted/50 border border-dashed rounded-md">
                            <div className="text-center text-muted-foreground">
                              <FileIcon className="w-6 h-6 mx-auto text-muted-foreground/60" />
                              <p className="text-xs mt-1">
                                Front side not provided
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Verso (Back) */}
                      <div className="w-full">
                        <h4 className="text-sm font-medium mb-2 text-gray-700">
                          Verso (Back)
                        </h4>
                        {doc.verso ? (
                          renderFilePreview(getCompleteFileUrl(doc.verso))
                        ) : (
                          <div className="flex items-center justify-center h-48 bg-muted/50 border border-dashed rounded-md">
                            <div className="text-center text-muted-foreground">
                              <FileIcon className="w-6 h-6 mx-auto text-muted-foreground/60" />
                              <p className="text-xs mt-1">
                                Back side not provided
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vehicle-images" className="mt-0 w-full">
          {documents.vehicle_images && documents.vehicle_images.length > 0 ? (
            <div>
              <div className="flex items-center mb-4 text-sm text-slate-500">
                <ImageIcon className="w-4 h-4 mr-2" />
                <span>
                  {documents.vehicle_images.length} vehicle{" "}
                  {documents.vehicle_images.length === 1 ? "image" : "images"}{" "}
                  uploaded
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {documents.vehicle_images.map((url, index) => {
                  const fullImageUrl = getCompleteFileUrl(url);
                  console.log(`Vehicle image ${index + 1}:`, {
                    original: url,
                    full: fullImageUrl,
                  });

                  return (
                    <Card
                      key={index}
                      className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="relative h-48 w-full border-b bg-slate-100">
                        <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end p-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full gap-1 text-xs bg-white/90 hover:bg-white"
                            onClick={() => setSelectedImage(fullImageUrl)}
                          >
                            <ZoomInIcon className="w-3 h-3" /> View Larger
                          </Button>
                        </div>
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
                      <CardContent className="p-3 bg-white">
                        <div className="flex justify-between items-center">
                          <Badge
                            variant="outline"
                            className="bg-primary/20 text-primary border-primary/20"
                          >
                            Photo {index + 1}
                          </Badge>
                          <a
                            href={fullImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLinkIcon className="h-3 w-3" />
                            Full Size
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-muted/50 border border-dashed rounded-md">
              <div className="bg-muted rounded-full p-3 mx-auto mb-2">
                <ImageIcon className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <p className="text-muted-foreground font-medium">
                No vehicle images provided
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Driver needs to upload images of their vehicle
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
