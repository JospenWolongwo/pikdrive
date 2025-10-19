'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNotificationPermission } from './useNotificationPermission';
import { detectDevice } from '@/lib/utils/device-detection';

interface UseNotificationPromptReturn {
  readonly showPrompt: boolean;
  readonly openPrompt: () => void;
  readonly closePrompt: () => void;
  readonly shouldShowPrompt: () => boolean;
}

const STORAGE_KEY = 'pikdrive_notification_prompt_seen';
const PROMPT_DELAY = 2000; // 2 seconds delay before showing

/**
 * Hook for managing custom notification permission prompt
 * Handles timing, storage, and smart display logic
 */
export function useNotificationPrompt(): UseNotificationPromptReturn {
  const [showPrompt, setShowPrompt] = useState(false);
  const { isSubscribed, permission } = useNotificationPermission();
  const [deviceInfo] = useState(() => detectDevice());

  /**
   * Check if prompt should be shown
   */
  const shouldShowPrompt = useCallback((): boolean => {
    // Don't show during SSR
    if (typeof window === 'undefined') {
      return false;
    }

    // Don't show if already subscribed
    if (isSubscribed) {
      return false;
    }

    // Don't show if permanently denied
    if (permission === 'denied') {
      return false;
    }

    // Don't show if already seen recently (24 hours)
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen) {
      const lastSeenTime = parseInt(lastSeen, 10);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - lastSeenTime < twentyFourHours) {
        return false;
      }
    }

    // Don't show if device doesn't support web push
    if (!deviceInfo.supportsWebPush) {
      return false;
    }

    return true;
  }, [isSubscribed, permission, deviceInfo.supportsWebPush]);

  /**
   * Open the prompt
   */
  const openPrompt = useCallback(() => {
    if (shouldShowPrompt()) {
      setShowPrompt(true);
    }
  }, [shouldShowPrompt]);

  /**
   * Close the prompt and mark as seen
   */
  const closePrompt = useCallback(() => {
    setShowPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
  }, []);

  // Removed auto-show effect - prompt should only show when explicitly triggered

  /**
   * Hide prompt if user subscribes
   */
  useEffect(() => {
    if (isSubscribed && showPrompt) {
      setShowPrompt(false);
    }
  }, [isSubscribed, showPrompt]);

  return {
    showPrompt,
    openPrompt,
    closePrompt,
    shouldShowPrompt,
  };
}

/**
 * Hook for triggering prompt on specific user actions
 * Use this in components where you want to show prompt after user actions
 */
export function useNotificationPromptTrigger() {
  const { openPrompt, shouldShowPrompt } = useNotificationPrompt();

  /**
   * Trigger prompt after user action (e.g., booking, messaging)
   */
  const triggerPrompt = useCallback(() => {
    if (shouldShowPrompt()) {
      // Small delay to let the user action complete
      setTimeout(() => {
        openPrompt();
      }, 1000);
    }
  }, [openPrompt, shouldShowPrompt]);

  return {
    triggerPrompt,
    canTrigger: shouldShowPrompt(),
  };
}
