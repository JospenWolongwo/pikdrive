import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession()

  // Protected routes that require authentication
  const protectedPaths = [
    '/profile',           // User profile settings
    '/chat',             // Chat functionality
    '/rides/book',       // Booking rides
    '/rides/payment',    // Payment processing
    '/driver/dashboard'  // Driver's dashboard
  ]
  
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !session) {
    // Store the original URL to redirect back after login
    const redirectUrl = new URL('/auth', req.url)
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Driver-only routes
  const driverPaths = ['/driver/dashboard', '/rides/create']
  const isDriverPath = driverPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  if (isDriverPath && session) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'driver') {
      return NextResponse.redirect(new URL('/become-driver', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/chat/:path*',
    '/rides/book/:path*',
    '/rides/payment/:path*',
    '/driver/:path*'
  ]
}
