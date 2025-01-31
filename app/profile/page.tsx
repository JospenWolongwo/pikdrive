'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSupabase } from '@/providers/SupabaseProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { Camera, Loader2 } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cameroonCities } from '@/app/data/cities'

export default function ProfilePage() {
  const { user } = useAuth()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    city: '',
    profilePicture: null as File | null
  })

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    const loadProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (profile) {
          setFormData(prev => ({
            ...prev,
            fullName: profile.full_name || '',
            email: profile.email || '',
            city: profile.city || ''
          }))

          if (profile.avatar_url) {
            const { data: { publicUrl } } = supabase
              .storage
              .from('avatars')
              .getPublicUrl(profile.avatar_url)
            setAvatarUrl(publicUrl)
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }

    loadProfile()
  }, [user, supabase, router])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0]
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "File size must be less than 5MB",
      })
      return
    }

    // Check file type and get extension
    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    }
    
    if (!allowedTypes[file.type as keyof typeof allowedTypes]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please upload a valid image file (JPEG, PNG, GIF, or WebP)",
      })
      return
    }

    try {
      setIsLoading(true)

      // Generate a unique file name with proper extension
      const timestamp = Date.now()
      const fileExt = allowedTypes[file.type as keyof typeof allowedTypes]
      const fileName = `${timestamp}.${fileExt}`
      const filePath = `${user?.id}/${fileName}`

      // Upload the new file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: 'no-cache',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: filePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (updateError) throw updateError

      // Update the UI with a cache-busting URL
      setAvatarUrl(`${publicUrl}?v=${timestamp}`)
      
      toast({
        title: "Success!",
        description: "Profile picture updated successfully",
      })

      // Force a reload to update the avatar everywhere
      router.refresh()
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast({
        variant: "destructive",
        title: "Error uploading image",
        description: error.message || "Failed to upload image. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          full_name: formData.fullName,
          email: formData.email,
          city: formData.city,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast({
        title: "Success!",
        description: "Profile updated successfully",
        duration: 3000,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      })
    }
  }

  if (!user) return null

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-32 h-32 border-2 border-primary/10">
                {avatarUrl ? (
                  <AvatarImage 
                    src={avatarUrl} 
                    alt="Profile picture"
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-primary/5">
                    {formData.fullName ? formData.fullName[0].toUpperCase() : user?.phone?.slice(-2) || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                disabled={isLoading}
                className="hidden"
              />
            </div>
            {isLoading && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <SearchableSelect
                options={[...cameroonCities]}
                value={formData.city}
                onValueChange={(value) => setFormData(prev => ({ ...prev, city: value }))}
                placeholder="Select your city"
                searchPlaceholder="Search cities..."
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              Sign Out
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
