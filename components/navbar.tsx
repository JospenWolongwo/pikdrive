"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  User,
  Car,
  Settings,
  LayoutDashboard,
  BookOpen,
  Download,
  Search,
  MessageSquare,
  PlusCircle,
  CalendarCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { useShowAndroidPrompt } from "@/components/pwa/PWAPrompts";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale, usePWA, useDeviceDetect } from "@/hooks";

export function Navbar() {
  const { supabase, user, loading } = useSupabase();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const { setShowAndroid } = useShowAndroidPrompt();
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();
  const { 
    unreadCounts, 
    fetchUnreadCounts, 
    subscribeToAllConversations, 
    unsubscribeFromAllConversations 
  } = useChatStore();

  useEffect(() => {
    setMounted(true);
    if (isIOSDevice) {
      setShowIOSPrompt(true);
    } else {
      setShowAndroid(true);
    }
  }, [setShowAndroid, isIOSDevice]);


  useEffect(() => {
    if (!user) return;

    const getDriverStatus = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_driver, driver_status, avatar_url, full_name")
        .eq("id", user.id)
        .maybeSingle();

      // If profile doesn't exist (PGRST116 = not found), create it
      if ((error && error.code === 'PGRST116') || !data) {
        const { error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            phone: user.phone || null,
            email: user.email || null,
            full_name: null,
            city: null,
            avatar_url: null,
            is_driver: false,
            driver_status: 'pending',
            role: 'user',
            driver_application_status: 'pending',
            driver_application_date: null,
            is_driver_applicant: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        // If profile already exists (409/23505 = unique constraint violation), just fetch it
        if (createError && (createError.code === '23505' || createError.message?.includes('duplicate'))) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("is_driver, driver_status, avatar_url, full_name")
            .eq("id", user.id)
            .single();

          if (existingProfile) {
            setIsDriver(existingProfile.is_driver || false);
            setDriverStatus(existingProfile.driver_status || null);
            setFullName(existingProfile.full_name || null);
            if (existingProfile.avatar_url) {
              const {
                data: { publicUrl },
              } = supabase.storage.from("avatars").getPublicUrl(existingProfile.avatar_url);
              setAvatarUrl(publicUrl);
            }
          }
          return;
        }

        if (!createError) {
          // Retry fetching
          const { data: newProfile } = await supabase
            .from("profiles")
            .select("is_driver, driver_status, avatar_url, full_name")
            .eq("id", user.id)
            .single();

          if (newProfile) {
            setIsDriver(newProfile.is_driver || false);
            setDriverStatus(newProfile.driver_status || null);
            setFullName(newProfile.full_name || null);
            if (newProfile.avatar_url) {
              const {
                data: { publicUrl },
              } = supabase.storage.from("avatars").getPublicUrl(newProfile.avatar_url);
              setAvatarUrl(publicUrl);
            }
          }
        }
        return;
      }

      // Profile exists - use it
      setIsDriver(data.is_driver || false);
      setDriverStatus(data.driver_status || null);
      setFullName(data.full_name || null);
      if (data.avatar_url) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(data.avatar_url);
        setAvatarUrl(publicUrl);
      }
    };

    // Initial load
    getDriverStatus();

    // Subscribe to real-time profile updates
    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<{
          is_driver: boolean;
          driver_status: string;
          avatar_url: string | null;
          full_name: string | null;
        }>) => {
          // Profile was updated, refresh navbar data
          const updatedProfile = payload.new as {
            is_driver?: boolean;
            driver_status?: string;
            avatar_url?: string | null;
            full_name?: string | null;
          };

          if (updatedProfile.is_driver !== undefined) {
            setIsDriver(updatedProfile.is_driver);
          }
          if (updatedProfile.driver_status !== undefined) {
            setDriverStatus(updatedProfile.driver_status);
          }
          if (updatedProfile.full_name !== undefined) {
            setFullName(updatedProfile.full_name);
          }
          if (updatedProfile.avatar_url !== undefined) {
            if (updatedProfile.avatar_url) {
              const {
                data: { publicUrl },
              } = supabase.storage.from("avatars").getPublicUrl(updatedProfile.avatar_url);
              setAvatarUrl(publicUrl);
            } else {
              setAvatarUrl(null);
            }
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Fetch unread counts when user is available
  useEffect(() => {
    if (user) {
      fetchUnreadCounts(user.id);
    }
  }, [user, fetchUnreadCounts]);

  // Subscribe to real-time message updates for navbar unread counter
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to all conversations for real-time unread count updates
    subscribeToAllConversations(user.id);
    
    return () => {
      unsubscribeFromAllConversations();
    };
  }, [user, subscribeToAllConversations, unsubscribeFromAllConversations]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    { href: "/", label: t("navigation.home") },
    { href: "/rides", label: t("navigation.findRide") },
    { href: "/about", label: t("navigation.about") },
    { href: "/advice", label: t("navigation.safety") },
    { href: "/contact", label: t("navigation.contact") },
  ];

  const NavItems = ({ className }: { className?: string }) => (
    <div className={cn("flex gap-6", className)}>
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
  );

  function PWAInstallButton() {
    const { setShowAndroid } = useShowAndroidPrompt();
    const { isInstallable, hasPrompt, install } = usePWA();
    const { isIOSDevice, isAndroidDevice } = useDeviceDetect();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleInstallClick = async () => {
      if (isIOSDevice) {
        setShowIOSPrompt(true);
      } else if (isAndroidDevice) {
        try {
          const success = await install();

          if (!success) {
            setShowAndroid(true);
          }
        } catch (err) {
          console.error("Installation error:", err);
          setShowAndroid(true);
        }
      }
    };


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
          <span>{t("pwa.installApp")}</span>
        </Button>
      );
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
          <span>{t("pwa.installApp")}</span>
        </Button>
      );
    }

    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {showIOSPrompt && (
        <IOSInstallPrompt
          show={showIOSPrompt}
          onClose={() => setShowIOSPrompt(false)}
        />
      )}
      <div className="container flex h-16 items-center">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">{t("common.toggleMenu")}</span>
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
          <Link href="/" className="flex flex-col md:flex-row items-start md:items-center space-y-0.5 md:space-y-0 md:space-x-2">
            <Car className="h-5 w-5 md:h-6 md:w-6" />
            <span className="font-bold text-sm md:text-base">PikDrive</span>
          </Link>
          <NavItems className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-2">
          {/* Messages Button with notification badge */}
          {!loading && user && (
            <Link href="/messages">
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full"
              >
                <MessageSquare className="h-5 w-5" />
                {unreadCounts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white">
                    {unreadCounts.reduce((sum, item) => sum + item.count, 0)}
                  </span>
                )}
                <span className="sr-only">{t("common.messages")}</span>
              </Button>
            </Link>
          )}

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-full"
          >
            {mounted &&
              (theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              ))}
            <span className="sr-only">
              {mounted
                ? theme === "light"
                  ? t("theme.darkMode")
                  : t("theme.lightMode")
                : t("theme.toggleTheme")}
            </span>
          </Button>

          {/* Quick Actions Dropdown for all users */}
          {!loading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 rounded-full"
                >
                  <span className="hidden sm:inline">{t("common.options")}</span>
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href="/bookings" className="flex items-center">
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    <span>{t("navigation.myBookings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/rides" className="flex items-center">
                    <Search className="mr-2 h-4 w-4" />
                    <span>{t("navigation.search")}</span>
                  </Link>
                </DropdownMenuItem>
                {isDriver && driverStatus === "approved" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/driver/rides/new"
                        className="flex items-center"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>{t("navigation.publishRide")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/driver/dashboard"
                        className="flex items-center"
                      >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>{t("navigation.myRides")}</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isDriver && driverStatus === "pending" && (
                  <DropdownMenuItem asChild>
                    <Link href="/driver/pending" className="flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>{t("navigation.applicationStatus")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Menu */}
          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                      {fullName
                        ? fullName.charAt(0).toUpperCase()
                        : user.email?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>{isDriver ? t("navigation.driverProfile") : t("navigation.profile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t("navigation.settings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("navigation.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !loading ? (
            <Button onClick={() => router.replace('/auth')}>
              {t("navigation.login")}
            </Button>
          ) : (
            <Button disabled size="sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
