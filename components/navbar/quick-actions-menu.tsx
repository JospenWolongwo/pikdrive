"use client";

import Link from "next/link";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import {
  Menu,
  Search,
  PlusCircle,
  CalendarCheck,
  LayoutDashboard,
} from "lucide-react";
import { useLocale } from "@/hooks";

interface QuickActionsMenuProps {
  readonly isDriver: boolean;
  readonly driverStatus: string | null;
}

export function QuickActionsMenu({ isDriver, driverStatus }: QuickActionsMenuProps) {
  const { t } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 rounded-full">
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
              <Link href="/driver/rides/new" className="flex items-center">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>{t("navigation.publishRide")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/driver/dashboard" className="flex items-center">
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
  );
}
