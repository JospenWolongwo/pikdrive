"use client";

import Link from "next/link";
import { Button, Sheet, SheetContent, SheetTrigger } from "@/components/ui";
import { Menu, Car } from "lucide-react";
import { useLocale } from "@/hooks";
import { NavbarPWAButton } from "./navbar-pwa-button";

interface MenuItem {
  readonly href: string;
  readonly label: string;
}

interface MobileSheetProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly menuItems: readonly MenuItem[];
  readonly onShowIOSPrompt: () => void;
}

export function MobileSheet({ isOpen, onOpenChange, menuItems, onShowIOSPrompt }: MobileSheetProps) {
  const { t } = useLocale();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
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
          <NavbarPWAButton onShowIOSPrompt={onShowIOSPrompt} />
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => onOpenChange(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
