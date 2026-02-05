"use client"

import { useState } from "react"
import { FormControl, FormField, FormItem, Input } from "@/components/ui"
import { CheckCircle2, Loader2, Upload, Check } from "lucide-react"

interface DocumentUploadProps {
  title: string
  icon: React.ReactNode
  description: string
  formControl: any
  rectoName: string
  versoName: string
  rectoValue: string
  versoValue: string
  uploadingRecto: boolean
  uploadingVerso: boolean
  onRectoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVersoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Reusable component for document uploads that handles both recto (front) and verso (back)
 */
export function DocumentUpload({
  title,
  icon,
  description,
  formControl,
  rectoName,
  versoName,
  rectoValue,
  versoValue,
  uploadingRecto,
  uploadingVerso,
  onRectoUpload,
  onVersoUpload
}: DocumentUploadProps) {
  return (
    <div className="border rounded-lg p-5 bg-gray-50/50 hover:bg-blue-50/20 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {(rectoValue && versoValue) && <Check className="h-5 w-5 text-green-600" />}
      </div>
      
      <FormField
        control={formControl}
        name={rectoName}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <div className="text-sm text-muted-foreground mb-2">
              {description}
            </div>
            
            {/* Recto (Front) */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Recto (Face avant)</p>
              <div className="relative group border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary transition-colors">
                <div className="text-center py-2">
                  {uploadingRecto ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                      <p className="text-primary text-sm font-medium">Téléchargement en cours...</p>
                    </div>
                  ) : rectoValue ? (
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 text-sm font-medium">Recto téléchargé</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Cliquez ou déposez le recto ici</p>
                    </div>
                  )}
                </div>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={onRectoUpload}
                    className="cursor-pointer absolute inset-0 opacity-0 z-10"
                    disabled={uploadingRecto}
                  />
                </FormControl>
              </div>
            </div>
            
            {/* Verso (Back) */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Verso (Face arrière)</p>
              <div className="relative group border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary transition-colors">
                <div className="text-center py-2">
                  {uploadingVerso ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                      <p className="text-primary text-sm font-medium">Téléchargement en cours...</p>
                    </div>
                  ) : versoValue ? (
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 text-sm font-medium">Verso téléchargé</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Cliquez ou déposez le verso ici</p>
                    </div>
                  )}
                </div>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={onVersoUpload}
                    className="cursor-pointer absolute inset-0 opacity-0 z-10"
                    disabled={uploadingVerso}
                  />
                </FormControl>
              </div>
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}
