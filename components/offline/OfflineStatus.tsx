"use client";

import { useEffect } from "react";
import { useLocale, useNetworkStatus } from "@/hooks";
import { useAppStore } from "@/stores";

export function OfflineStatus() {
  const { t } = useLocale();
  const { isOnline } = useNetworkStatus();
  const setOfflineMode = useAppStore((state) => state.setOfflineMode);

  useEffect(() => {
    setOfflineMode(!isOnline);
  }, [isOnline, setOfflineMode]);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-destructive text-destructive-foreground"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-xs font-medium sm:text-sm">
        <span>{t("offline.title")}</span>
        <span className="hidden opacity-90 sm:inline">
          — {t("offline.description")}
        </span>
      </div>
    </div>
  );
}
