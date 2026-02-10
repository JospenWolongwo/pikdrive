"use client";

import { useEffect } from "react";
import { useNetworkStatus } from "@/hooks";
import { offlineActionHandlers } from "@/lib/offline/offline-queue-handlers";
import { useOfflineQueueStore } from "@/stores";

const PROCESS_INTERVAL_MS = 15000;

export function OfflineQueueProcessor() {
  const { isOnline } = useNetworkStatus();
  const queueLength = useOfflineQueueStore((state) => state.queue.length);
  const isProcessing = useOfflineQueueStore((state) => state.isProcessing);
  const processQueue = useOfflineQueueStore((state) => state.processQueue);

  useEffect(() => {
    if (!isOnline || queueLength === 0 || isProcessing) return;
    void processQueue(offlineActionHandlers);
  }, [isOnline, queueLength, isProcessing, processQueue]);

  useEffect(() => {
    if (!isOnline || queueLength === 0) return;

    const interval = setInterval(() => {
      if (!useOfflineQueueStore.getState().isProcessing) {
        void useOfflineQueueStore
          .getState()
          .processQueue(offlineActionHandlers);
      }
    }, PROCESS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOnline, queueLength]);

  return null;
}
