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
   * Check if prompt should be shown (with optional priority bypass)
   * Priority events (like payment completion) can bypass the 24h cooldown
   */
  const shouldShowPromptWithPriority = useCallback((priority: boolean = false): boolean => {
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

    // Don't show if device doesn't support web push
    if (!deviceInfo.supportsWebPush) {
      return false;
    }

    // If priority is true, bypass the 24h cooldown for critical events
    if (priority) {
      return true;
    }

    // Check 24h cooldown for non-priority events
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen) {
      const lastSeenTime = parseInt(lastSeen, 10);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - lastSeenTime < twentyFourHours) {
        return false;
      }
    }

    return true;
  }, [isSubscribed, permission, deviceInfo.supportsWebPush]);

  /**
   * Listen for trigger events from other components
   * Supports both regular and priority triggers
   */
  useEffect(() => {
    const handleTriggerEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ priority?: boolean }>;
      const isPriority = customEvent.detail?.priority === true;
      
      if (shouldShowPromptWithPriority(isPriority)) {
        openPrompt();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pikdrive-show-notification-prompt', handleTriggerEvent);
      return () => {
        window.removeEventListener('pikdrive-show-notification-prompt', handleTriggerEvent);
      };
    }
  }, [openPrompt, shouldShowPromptWithPriority]);

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
  /**
   * Trigger prompt after user action (e.g., booking, messaging)
   * Uses custom event to communicate with the main prompt instance
   * @param priority - If true, bypasses 24h cooldown for critical events (e.g., payment completion)
   */
  const triggerPrompt = useCallback((priority: boolean = false) => {
    if (typeof window !== 'undefined') {
      // Dispatch custom event that the main prompt instance can listen to
      window.dispatchEvent(new CustomEvent('pikdrive-show-notification-prompt', {
        detail: { priority }
      }));
    }
  }, []);

  return {
    triggerPrompt,
    canTrigger: true, // Always allow trigger attempt
  };
}
