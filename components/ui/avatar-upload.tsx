"use client"

import { useEffect, useState } from "react"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Camera } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

interface AvatarUploadProps {
  uid: string
  url: string | null
  size?: number
  onUpload: (url: string) => void
}

export function AvatarUpload({ uid, url, size = 150, onUpload }: AvatarUploadProps) {
  const { supabase } = useSupabase()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (url) downloadImage(url)
  }, [url])

  async function downloadImage(path: string) {
    try {
      const { data, error } = await supabase.storage
        .from("avatars")
        .download(path)
      if (error) {
        throw error
      }

      const url = URL.createObjectURL(data)
      setAvatarUrl(url)
    } catch (error) {
      console.error("Error downloading image: ", error)
    }
  }

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.")
      }

      const file = event.target.files[0]
      const fileExt = file.name.split(".").pop()
      const filePath = `${uid}/${uuidv4()}.${fileExt}`

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      onUpload(filePath)
      
      toast({
        title: "Success",
        description: "Avatar updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Error uploading avatar",
        variant: "destructive",
      })
      console.error("Error uploading avatar:", error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar className="relative group" style={{ width: size, height: size }}>
        <AvatarImage
          src={avatarUrl || ""}
          className="object-cover"
          style={{ width: size, height: size }}
        />
        <AvatarFallback className="bg-primary/5">
          {uid.slice(0, 2).toUpperCase()}
        </AvatarFallback>
        <label
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
          htmlFor="single"
        >
          <Camera className="w-6 h-6" />
        </label>
      </Avatar>
      <div style={{ width: size }}>
        <input
          style={{
            visibility: "hidden",
            position: "absolute",
          }}
          type="file"
          id="single"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
        />
      </div>
      {uploading && (
        <div className="text-sm text-muted-foreground">Uploading...</div>
      )}
    </div>
  )
}
