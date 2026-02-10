"use client";

import { useMemo } from "react";
import { useOfflineQueueStore } from "@/stores";
import { useLocale } from "@/hooks";

interface PendingSyncBadgeProps {
  rideId: string;
}

export function PendingSyncBadge({ rideId }: PendingSyncBadgeProps) {
  const { t } = useLocale();
  const queue = useOfflineQueueStore((state) => state.queue);

  const hasPending = useMemo(
    () =>
      queue.some(
        (action) =>
          action.type === "booking.intent" &&
          action.meta?.entityId === rideId
      ),
    [queue, rideId]
  );

  if (!hasPending) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
      {t("offlineSync.pending")}
    </span>
  );
}
