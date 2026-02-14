"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores";
import { Button } from "@/components/ui";
import { Sun, Moon, Car, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";
import { useShowAndroidPrompt } from "@/components/pwa/PWAPrompts";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale, useDeviceDetect } from "@/hooks";
import { useNavbarProfile } from "@/hooks/common/useNavbarProfile";
import { MobileSheet } from "./mobile-sheet";
import { QuickActionsMenu } from "./quick-actions-menu";
import { UserMenu } from "./user-menu";

export function Navbar() {
  const { user, loading } = useSupabase();
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const { setShowAndroid } = useShowAndroidPrompt();
  const { isIOSDevice } = useDeviceDetect();
  const { isDriver, driverStatus, avatarUrl, fullName } = useNavbarProfile();
  const {
    unreadCounts,
    fetchUnreadCounts,
    subscribeToAllConversations,
    unsubscribeFromAllConversations,
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
    if (user) fetchUnreadCounts(user.id);
  }, [user, fetchUnreadCounts]);

  // Real-time unread count updates across all conversations
  useEffect(() => {
    if (!user) return;
    subscribeToAllConversations(user.id);
    return () => { unsubscribeFromAllConversations(); };
  }, [user, subscribeToAllConversations, unsubscribeFromAllConversations]);

  const menuItems = [
    { href: "/", label: t("navigation.home") },
    { href: "/rides", label: t("navigation.findRide") },
    { href: "/about", label: t("navigation.about") },
    { href: "/advice", label: t("navigation.safety") },
    { href: "/contact", label: t("navigation.contact") },
  ] as const;

  const totalUnread = unreadCounts.reduce((sum, item) => sum + item.count, 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {showIOSPrompt && (
        <IOSInstallPrompt show={showIOSPrompt} onClose={() => setShowIOSPrompt(false)} />
      )}
      <div className="container flex h-16 items-center">
        <MobileSheet
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          menuItems={menuItems}
          onShowIOSPrompt={() => setShowIOSPrompt(true)}
        />

        <div className="flex items-center gap-2 md:gap-6 flex-1">
          <Link href="/" className="flex flex-col md:flex-row items-start md:items-center space-y-0.5 md:space-y-0 md:space-x-2">
            <Car className="h-5 w-5 md:h-6 md:w-6" />
            <span className="font-bold text-sm md:text-base">PikDrive</span>
          </Link>
          <NavItems menuItems={menuItems} className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-2">
          {!loading && user && (
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <MessageSquare className="h-5 w-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white">
                    {totalUnread}
                  </span>
                )}
                <span className="sr-only">{t("common.messages")}</span>
              </Button>
            </Link>
          )}

          <LanguageSwitcher />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-full"
          >
            {mounted && (theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />)}
            <span className="sr-only">
              {mounted
                ? theme === "light" ? t("theme.darkMode") : t("theme.lightMode")
                : t("theme.toggleTheme")}
            </span>
          </Button>

          {!loading && user && (
            <QuickActionsMenu isDriver={isDriver} driverStatus={driverStatus} />
          )}

          <UserMenu isDriver={isDriver} avatarUrl={avatarUrl} fullName={fullName} />
        </div>
      </div>
    </header>
  );
}

function NavItems({ menuItems, className }: {
  readonly menuItems: readonly { readonly href: string; readonly label: string }[];
  readonly className?: string;
}) {
  return (
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
}
