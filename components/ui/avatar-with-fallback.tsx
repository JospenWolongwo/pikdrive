import { Avatar, AvatarImage, AvatarFallback } from './avatar'
import { User } from '@supabase/supabase-js'
import { useSupabase } from '@/providers/SupabaseProvider'
import { useEffect, useState } from 'react'

interface AvatarWithFallbackProps {
  user?: User | null
  profile?: {
    full_name?: string | null
    avatar_url?: string | null
  } | null
  className?: string
  fallbackClassName?: string
}

export function AvatarWithFallback({ 
  user, 
  profile, 
  className = "w-8 h-8",
  fallbackClassName = "" 
}: AvatarWithFallbackProps) {
  const { supabase } = useSupabase()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.avatar_url) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(profile.avatar_url)
      setAvatarUrl(`${publicUrl}?v=${Date.now()}`)
    }
  }, [profile?.avatar_url, supabase])

  const getFallbackText = () => {
    if (profile?.full_name) {
      return profile.full_name.charAt(0).toUpperCase()
    }
    if (user?.phone) {
      return user.phone.slice(-2)
    }
    return 'U'
  }

  return (
    <Avatar className={className}>
      <AvatarImage 
        src={avatarUrl || '/defaults/avatar.svg'} 
        alt={profile?.full_name || 'User avatar'}
      />
      <AvatarFallback className={fallbackClassName}>
        {getFallbackText()}
      </AvatarFallback>
    </Avatar>
  )
}
