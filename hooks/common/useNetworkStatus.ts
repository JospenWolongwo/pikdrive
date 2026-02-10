"use client";

import { useCallback, useEffect, useState } from "react";

interface NetworkStatusOptions {
  initialOnline?: boolean;
  onStatusChange?: (isOnline: boolean) => void;
}

interface NetworkStatusState {
  isOnline: boolean;
  lastChangedAt: number | null;
}

const getInitialOnline = (fallback: boolean) => {
  if (typeof navigator === "undefined") return fallback;
  return navigator.onLine;
};

export function useNetworkStatus(options: NetworkStatusOptions = {}) {
  const { initialOnline = true, onStatusChange } = options;

  const [state, setState] = useState<NetworkStatusState>(() => ({
    isOnline: getInitialOnline(initialOnline),
    lastChangedAt: null,
  }));

  const updateStatus = useCallback(
    (nextOnline: boolean) => {
      setState((prev) => {
        if (prev.isOnline === nextOnline) {
          return prev;
        }

        onStatusChange?.(nextOnline);

        return {
          isOnline: nextOnline,
          lastChangedAt: Date.now(),
        };
      });
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => updateStatus(true);
    const handleOffline = () => updateStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync with current browser state on mount
    updateStatus(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [updateStatus]);

  return state;
}
