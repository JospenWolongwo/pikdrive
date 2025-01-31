import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protected routes that require authentication
  const protectedPaths = [
    '/profile',           // User profile settings
    '/bookings',         // User's bookings
    '/driver/dashboard', // Driver's dashboard
    '/driver/rides',     // Driver's rides
    '/payments',         // Payment processing
    '/settings'          // User settings
  ]
  
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  // If trying to access protected routes without authentication
  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/auth', req.url)
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If the user is signed in and the current path is /auth,
  // redirect the user to the intended destination or home
  if (session && req.nextUrl.pathname.startsWith('/auth')) {
    const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/'
    return NextResponse.redirect(new URL(redirectTo, req.url))
  }

  return res
}

// Ensure the middleware is only called for relevant paths
export const config = {
  matcher: [
    '/profile/:path*',
    '/bookings/:path*',
    '/driver/:path*',
    '/payments/:path*',
    '/settings/:path*',
    '/auth/:path*'
  ]
}
