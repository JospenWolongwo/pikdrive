'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useSupabase } from '@/providers/SupabaseProvider'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Sun, Moon, LogOut, User, Car, Settings, LayoutDashboard, BookOpen } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'
import { PhoneCall, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { supabase, user } = useSupabase()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [isDriver, setIsDriver] = useState(false)
  const [driverStatus, setDriverStatus] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      const getDriverStatus = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('is_driver, driver_status, avatar_url')
          .eq('id', user.id)
          .single()
        
        setIsDriver(data?.is_driver || false)
        setDriverStatus(data?.driver_status || null)
        if (data?.avatar_url) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.avatar_url)
          setAvatarUrl(publicUrl)
        }
      }
      getDriverStatus()
    }
  }, [user, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const menuItems = [
    { href: '/', label: 'Home' },
    { href: '/rides', label: 'Find Rides' },
    { href: '/about', label: 'About' },
    { href: '/advice', label: 'Safety & FAQ' },
    { href: '/contact', label: 'Contact' },
  ]

  const NavItems = ({ className }: { className?: string }) => (
    <div className={cn('flex gap-6', className)}>
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-sm font-medium transition-colors hover:text-primary"
        >
          {item.label}
        </Link>
      ))}
    </div>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <Link href="/" className="flex items-center space-x-2">
              <Car className="h-6 w-6" />
              <span className="font-bold">PikDrive</span>
            </Link>
            <div className="my-4 flex flex-col space-y-3">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium transition-colors hover:text-primary hover:bg-muted px-2 py-1.5 rounded-md"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="mr-4 md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Car className="h-6 w-6" />
            <span className="font-bold">PikDrive</span>
          </Link>
          <NavItems className="hidden md:flex" />
        </div>
        <div className="flex flex-1 items-center justify-between space-x-1 sm:space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* WhatsApp */}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-green-500 hover:text-green-600 hover:bg-green-100"
              >
                <a 
                  href="https://wa.me/+237698805890"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <BsWhatsapp className="h-4 w-4 sm:h-5 sm:w-5" />
                </a>
              </Button>

              {/* Phone */}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-primary hover:text-primary/80"
              >
                <a href="tel:+237698805890" className="flex items-center">
                  <PhoneCall className="h-4 w-4 sm:h-5 sm:w-5" />
                </a>
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="hover:bg-muted"
              >
                {theme === 'light' ? <Moon className="h-4 w-4 sm:h-5 sm:w-5" /> : <Sun className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
            </div>
          </div>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl || ""} />
                    <AvatarFallback>
                      {user.email?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href={isDriver ? "/driver/profile" : "/profile"} className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>{isDriver ? "Driver Profile" : "Profile"}</span>
                  </Link>
                </DropdownMenuItem>
                {isDriver && driverStatus === 'approved' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/driver/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/driver/bookings" className="flex items-center">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Bookings
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isDriver && driverStatus === 'pending' && (
                  <DropdownMenuItem asChild>
                    <Link href="/driver/pending" className="flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>Application Status</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/bookings" className="flex items-center">
                    <Car className="mr-2 h-4 w-4" />
                    <span>My Rides</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}