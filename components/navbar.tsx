"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSupabase } from "@/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePWA } from "@/hooks/usePWA";
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
} from "lucide-react";
import { BsWhatsapp } from "react-icons/bs";
import { PhoneCall, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { useShowAndroidPrompt } from "@/components/pwa/PWAPrompts";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";

export function Navbar() {
  const { supabase, user } = useSupabase();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const { setShowAndroid } = useShowAndroidPrompt();
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();
  const { isInstallable, hasPrompt, install, isInstalled } = usePWA();

  useEffect(() => {
    setMounted(true);
    // Only show install prompts if the app is not already installed
    if (!isInstalled) {
      if (isIOSDevice) {
        setShowIOSPrompt(true);
      } else if (isAndroidDevice) {
        setShowAndroid(true);
      }
    }
  }, [setShowAndroid, isIOSDevice, isAndroidDevice, isInstalled]);

  useEffect(() => {
    if (user) {
      const getDriverStatus = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("is_driver, driver_status, avatar_url")
          .eq("id", user.id)
          .single();

        setIsDriver(data?.is_driver || false);
        setDriverStatus(data?.driver_status || null);
        if (data?.avatar_url) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("avatars").getPublicUrl(data.avatar_url);
          setAvatarUrl(publicUrl);
        }
      };
      getDriverStatus();
    }
  }, [user, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    { href: "/", label: "Home" },
    { href: "/rides", label: "Find Rides" },
    { href: "/about", label: "About" },
    { href: "/advice", label: "Safety & FAQ" },
    { href: "/contact", label: "Contact" },
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

  const handleInstallClick = useCallback(async () => {
    console.log("🔍 Install button clicked:", {
      isInstallable,
      hasPrompt,
      isIOSDevice,
      isAndroidDevice,
      isInstalled,
    });

    // Don't do anything if already installed
    if (isInstalled) {
      console.log("🏠 App already installed, ignoring install click");
      return;
    }

    if (!isInstallable) {
      console.log("❌ App not installable");
      return;
    }

    if (isIOSDevice) {
      setShowIOSPrompt(true);
    } else if (isAndroidDevice) {
      if (hasPrompt) {
        console.log("🚀 Attempting installation...");
        const success = await install();
        if (!success) {
          // If the native prompt fails, show our custom dialog
          setShowAndroid(true);
        }
      } else {
        // No native prompt available, show our custom dialog
        setShowAndroid(true);
      }
    }
  }, [
    isInstallable,
    hasPrompt,
    install,
    isIOSDevice,
    isAndroidDevice,
    setShowAndroid,
    isInstalled,
  ]);

  const showInstallButton = isInstallable && !isInstalled;

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
            <nav className="my-6 flex flex-col space-y-4">
              {showInstallButton && mounted && (
                <Button
                  variant="default"
                  className="w-full flex items-center justify-center space-x-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleInstallClick}
                >
                  <Download className="h-4 w-4" />
                  <span>Install on {isIOSDevice ? "iOS" : "Android"}</span>
                </Button>
              )}
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
              {!user && (
                <Link
                  href="/auth"
                  className="flex items-center rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setIsOpen(false)}
                >
                  Sign Up
                </Link>
              )}
            </nav>
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
                className="text-green-500 hover:text-green-600 hover:bg-green-100"
                onClick={() =>
                  window.open("https://wa.me/237698805890", "_blank")
                }
              >
                <BsWhatsapp className="h-[0.65rem] w-[0.65rem] sm:h-4 sm:w-4" />
              </Button>

              {/* Phone */}
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
                onClick={() => window.open("tel:+237650056666")}
              >
                <PhoneCall className="h-[0.65rem] w-[0.65rem] sm:h-4 sm:w-4" />
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="hover:bg-muted"
              >
                {mounted &&
                  (theme === "light" ? (
                    <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                  ))}
              </Button>
            </div>
          </div>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
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
                  <Link
                    href={isDriver ? "/driver/profile" : "/profile"}
                    className="flex items-center"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>{isDriver ? "Driver Profile" : "Profile"}</span>
                  </Link>
                </DropdownMenuItem>
                {isDriver && driverStatus === "approved" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/driver/dashboard"
                        className="flex items-center"
                      >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/driver/bookings"
                        className="flex items-center"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Bookings
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isDriver && driverStatus === "pending" && (
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
            <Link
              href="/auth"
              className={cn(
                "px-3 py-2",
                "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Sign Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
