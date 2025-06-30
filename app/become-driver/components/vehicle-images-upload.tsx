"use client"

import { useState } from "react"
import Image from "next/image"
import { FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, Upload } from "lucide-react"

interface VehicleImagesUploadProps {
  images?: string[] // Images array
  isLoading: boolean // Loading state
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void // Upload handler
}

/**
 * Reusable component for vehicle images uploads
 */
export function VehicleImagesUpload({
  images,
  isLoading,
  onUpload
}: VehicleImagesUploadProps) {
  return (
    <div className="space-y-4">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 group hover:border-primary transition-colors cursor-pointer">
        <div className="flex flex-col items-center justify-center h-32">
          {isLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                    <p className="text-primary font-medium">Téléchargement en cours...</p>
                    <p className="text-xs text-muted-foreground mt-1">Vous ajoutez des photos de l&apos;intérieur et l&apos;extérieur de votre véhicule</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <Upload className="h-12 w-12 text-primary/70 mb-2 group-hover:text-primary transition-colors" />
                    <p className="font-medium text-gray-700 group-hover:text-gray-900">
                      Cliquez ou déposez vos photos ici
                    </p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      Vous pouvez sélectionner plusieurs images à la fois. Format accepté: JPG, PNG
                    </p>
                  </div>
                )}
              </div>
              
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={onUpload}
                disabled={isLoading}
                className="cursor-pointer opacity-0 absolute inset-0 h-full z-10"
              />
            </div>
      
      {images && images.length > 0 && (
        <div className="bg-white/80 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Photos téléchargées</h4>
            <span className="text-xs text-muted-foreground">{images.length} image{images.length > 1 ? 's' : ''}</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((url, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden aspect-square shadow-sm border border-gray-100">
                <Image
                  src={url}
                  alt={`Photo du véhicule ${index + 1}`}
                  className="object-cover transition-all group-hover:scale-105 group-hover:brightness-90"
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-white text-xs font-medium">Photo {index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
