// Professional OneSignal SDK wrapper
// Clean interface for OneSignal operations

import type { NotificationType, NotificationData } from '@/types/notification';

// OneSignal types are now defined in types/global.d.ts

export class OneSignalClient {
  private static instance: OneSignalClient;
  private initialized = false;
  private oneSignal: IOneSignal | null = null;
  private sdkReadyPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Singleton instance
   */
  static getInstance(): OneSignalClient {
    if (!OneSignalClient.instance) {
      OneSignalClient.instance = new OneSignalClient();
    }
    return OneSignalClient.instance;
  }

  /**
   * Initialize OneSignal SDK
   * Note: OneSignal is now initialized directly in layout.tsx using the official pattern
   */
  async initialize(appId: string): Promise<void> {
    console.log('🚀 OneSignal initialize called with App ID:', appId);
    
    if (this.initialized) {
      console.log('✅ OneSignal already initialized');
      return;
    }

    if (typeof window === 'undefined') {
      console.warn('⚠️ OneSignal can only be initialized in browser');
      return;
    }

    try {
      await this.waitForSDKReady();
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);
      throw error;
    }
  }

  private waitForSDKReady(): Promise<void> {
    if (this.initialized && this.oneSignal) {
      return Promise.resolve();
    }

    if (this.sdkReadyPromise) {
      return this.sdkReadyPromise;
    }

    console.log('⏳ Waiting for OneSignal SDK to be ready...');
    console.log('🔍 window.OneSignalDeferred exists:', !!window.OneSignalDeferred);
    console.log('🔍 window.OneSignal exists:', !!window.OneSignal);

    this.sdkReadyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.sdkReadyPromise = null;
        
        // Enhanced error detection for tracking protection
        const errorContext = {
          hasDeferred: !!window.OneSignalDeferred,
          hasOneSignal: !!window.OneSignal,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        };
        
        console.error('❌ OneSignal SDK initialization timeout', errorContext);
        
        // Detect if likely blocked by tracking protection
        if (!window.OneSignal && window.OneSignalDeferred) {
          console.error('🛡️ OneSignal SDK likely blocked by browser tracking protection (Firefox ETP, Brave Shields, etc.)');
          console.error('ℹ️ Users may need to disable tracking protection for this site to receive push notifications');
          reject(new Error('OneSignal SDK blocked by tracking protection. Push notifications unavailable.'));
        } else {
          reject(new Error('OneSignal SDK failed to become ready within 15 seconds'));
        }
      }, 15000);

      const markReady = (os: IOneSignal) => {
        clearTimeout(timeout);
        this.oneSignal = os;
        this.initialized = true;
        this.sdkReadyPromise = null;
        console.log('✅ OneSignal SDK ready');
        resolve();
      };

      const check = () => {
        const os = (typeof window !== 'undefined') ? window.OneSignal : null;
        const readyFlag = (typeof window !== 'undefined') ? window.__oneSignalReady === true : false;
        if (os && typeof os.login === 'function' && os.Notifications && os.User && readyFlag) {
          markReady(os);
        } else {
          setTimeout(check, 100);
        }
      };

      // Use deferred queue to run as soon as SDK provides the OneSignal object
      try {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(function(OneSignal: IOneSignal) {
          // If init already completed, required APIs should exist
          const readyFlag = (typeof window !== 'undefined') ? window.__oneSignalReady === true : false;
          if (OneSignal && typeof OneSignal.login === 'function' && OneSignal.Notifications && OneSignal.User && readyFlag) {
            markReady(OneSignal);
          } else {
            // Fallback to polling until APIs are available
            check();
          }
        });
      } catch {
        // Fallback if deferred queue is unavailable
        check();
      }
    });

    return this.sdkReadyPromise;
  }

  /**
   * Check if user has granted notification permission
   */
  async getPermission(): Promise<NotificationPermission> {
    if (!this.oneSignal) {
      return 'default';
    }

    try {
      const permission = await this.oneSignal.Notifications.permission;
      // Convert OneSignal boolean permission to standard NotificationPermission
      return permission ? 'granted' : 'denied';
    } catch (error) {
      console.error('Error getting permission:', error);
      return 'default';
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!this.oneSignal) {
      console.error('OneSignal not initialized');
      return false;
    }

    try {
      console.log('📱 Requesting notification permission...');
      const result = await this.oneSignal.Notifications.requestPermission();
      console.log(`✅ Permission result: ${result}`);
      return result;
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Check if user is subscribed to notifications
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.oneSignal) {
      return false;
    }

    try {
      const permission = await this.oneSignal.Notifications.permission;
      return permission === true;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Set external user ID (link with Supabase auth)
   */
  async setExternalUserId(userId: string): Promise<void> {
    if (!this.initialized || !this.oneSignal) {
      await this.waitForSDKReady();
    }

    if (!this.oneSignal) {
      throw new Error('OneSignal not initialized');
    }

    try {
      await this.oneSignal.login(userId);
      console.log(`✅ External user ID set: ${userId}`);
    } catch (error) {
      console.error('Error setting external user ID:', error);
      throw error;
    }
  }

  /**
   * Remove external user ID (on logout)
   */
  async removeExternalUserId(): Promise<void> {
    if (!this.initialized || !this.oneSignal) {
      try {
        await this.waitForSDKReady();
      } catch (e) {
        console.error('❌ OneSignal not ready for logout:', e);
        return;
      }
    }

    if (!this.oneSignal) {
      console.error('OneSignal not initialized for logout');
      return;
    }

    try {
      await this.oneSignal.logout();
      console.log('✅ External user ID removed');
    } catch (error) {
      console.error('Error removing external user ID:', error);
    }
  }

  /**
   * Add listener for notification clicks
   */
  onNotificationClick(
    callback: (event: { notification: { data: NotificationData } }) => void
  ): void {
    if (!this.oneSignal) {
      console.error('OneSignal not initialized');
      return;
    }

    try {
      this.oneSignal.Notifications.addEventListener('click', callback);
      console.log('✅ Notification click listener added');
    } catch (error) {
      console.error('Error adding notification click listener:', error);
    }
  }

  /**
   * Add listener for notifications displayed (foreground)
   */
  onNotificationDisplayed(
    callback: (event: { notification: { data: NotificationData } }) => void
  ): void {
    if (!this.oneSignal) {
      console.error('OneSignal not initialized');
      return;
    }

    try {
      this.oneSignal.Notifications.addEventListener('foregroundWillDisplay', callback);
      console.log('✅ Notification display listener added');
    } catch (error) {
      console.error('Error adding notification display listener:', error);
    }
  }

  /**
   * Get user's OneSignal ID
   */
  async getOneSignalId(): Promise<string | null> {
    if (!this.oneSignal) {
      return null;
    }

    try {
      const user = await this.oneSignal.User.getUser();
      return user?.onesignalId || null;
    } catch (error) {
      console.error('Error getting OneSignal ID:', error);
      return null;
    }
  }

  /**
   * Check if OneSignal is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
