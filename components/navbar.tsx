'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useSupabase } from '@/providers/SupabaseProvider'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePWA } from '@/hooks/usePWA'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Sun, Moon, LogOut, User, Car, Settings, LayoutDashboard, BookOpen, Download, Search, MessageSquare, PlusCircle, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IOSInstallPrompt } from '@/components/pwa/IOSInstallPrompt'
import { useShowAndroidPrompt } from '@/components/pwa/PWAPrompts'
import { useDeviceDetect } from '@/hooks/useDeviceDetect';

export function Navbar() {
  const { supabase, user } = useSupabase()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false)
  const [isDriver, setIsDriver] = useState(false)
  const [driverStatus, setDriverStatus] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const { setShowAndroid } = useShowAndroidPrompt();
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();

  useEffect(() => {
    setMounted(true);
    if (isIOSDevice) {
      setShowIOSPrompt(true);
    } else {
      setShowAndroid(true);
    }
  }, [setShowAndroid, isIOSDevice]);

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
    { href: '/', label: 'Accueil' },
    { href: '/rides', label: 'Trouver un Trajet' },
    { href: '/about', label: 'À Propos' },
    { href: '/advice', label: 'Sécurité & FAQ' },
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

  function PWAInstallButton() {
    const { setShowAndroid } = useShowAndroidPrompt();
    const { isInstallable, hasPrompt, install } = usePWA();
    const { isIOSDevice, isAndroidDevice } = useDeviceDetect();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleInstallClick = async () => {
      console.log('🔍 Install button clicked:', { isInstallable, hasPrompt, isIOSDevice, isAndroidDevice });
      
      if (isIOSDevice) {
        setShowIOSPrompt(true);
      } else if (isAndroidDevice) {
        try {
          console.log('🚀 Attempting installation...');
          const success = await install();
          
          if (!success) {
            console.log('ℹ️ Installation not completed, showing custom dialog');
            setShowAndroid(true);
          }
        } catch (err) {
          console.error('❌ Installation error:', err);
          setShowAndroid(true);
        }
      }
    };

    // For debugging
    useEffect(() => {
      console.log('📱 PWA Status:', {
        isInstallable,
        hasPrompt,
        isIOSDevice,
        isAndroidDevice,
        env: process.env.NODE_ENV
      });
    }, [isInstallable, hasPrompt, isIOSDevice, isAndroidDevice]);

    // Don't show if not mounted
    if (!mounted) return null;

    // For iOS devices, show iOS install instructions
    if (isIOSDevice) {
      return (
        <Button 
          onClick={() => setShowIOSPrompt(true)}
          variant="outline"
          size="sm"
          className="flex w-full items-center gap-2"
        >
          <Download className="h-4 w-4" /> 
          <span>Installer l&apos;App</span>
        </Button>
      )
    }

    // For Android devices, show Android install dialog
    if (isInstallable && mounted) {
      return (
        <Button 
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          className="flex w-full items-center gap-2"
        >
          <Download className="h-4 w-4" /> 
          <span>Installer l&apos;App</span>
        </Button>
      )
    }

    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {showIOSPrompt && <IOSInstallPrompt show={showIOSPrompt} onClose={() => setShowIOSPrompt(false)} />}
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
            <Link href="/" className="flex items-center gap-2">
              <Car className="h-6 w-6" />
              <span className="font-bold">PikDrive</span>
            </Link>
            <nav className="my-6 flex flex-col space-y-4">
              <PWAInstallButton />
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 md:gap-6 flex-1">
          <Link href="/" className="flex items-center space-x-2">
            <Car className="h-6 w-6" />
            <span className="font-bold">PikDrive</span>
          </Link>
          <NavItems className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Actions Dropdown for all users */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 rounded-full"
                >
                  <span className="hidden sm:inline">Options</span>
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href="/bookings" className="flex items-center">
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    <span>Vos Trajets</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages" className="flex items-center">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Messages</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/rides" className="flex items-center">
                    <Search className="mr-2 h-4 w-4" />
                    <span>Rechercher</span>
                  </Link>
                </DropdownMenuItem>
                {isDriver && driverStatus === 'approved' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/driver/add-ride" className="flex items-center">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Publier Trajet</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/driver/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Tableau de Bord</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/driver/bookings" className="flex items-center">
                        <BookOpen className="mr-2 h-4 w-4" />
                        <span>Réservations</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isDriver && driverStatus === 'pending' && (
                  <DropdownMenuItem asChild>
                    <Link href="/driver/pending" className="flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>Statut de Candidature</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="rounded-full"
          >
            {mounted && (theme === 'light' ? 
              <Moon className="h-4 w-4" /> : 
              <Sun className="h-4 w-4" />
            )}
            <span className="sr-only">
              {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
            </span>
          </Button>
          
          {/* User Menu */}
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
                    <span>{isDriver ? "Profil de Chauffeur" : "Profil"}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Déconnexion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/auth">Connexion</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}