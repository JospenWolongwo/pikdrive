// Device detection utilities for iOS compatibility
// Handles iOS version detection and browser compatibility

export interface DeviceInfo {
  readonly isIOS: boolean;
  readonly isAndroid: boolean;
  readonly isMobile: boolean;
  readonly isDesktop: boolean;
  readonly browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other';
  readonly iosVersion?: number;
  readonly supportsWebPush: boolean;
  readonly requiresUserGesture: boolean;
}

/**
 * Detect device and browser information
 */
export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isDesktop: true,
      browser: 'other',
      supportsWebPush: false,
      requiresUserGesture: false,
    };
  }

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid || /Mobile/.test(userAgent);
  const isDesktop = !isMobile;

  // Detect browser
  let browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other' = 'other';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'safari';
  } else if (userAgent.includes('Chrome')) {
    browser = 'chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'edge';
  }

  // Detect iOS version
  let iosVersion: number | undefined;
  if (isIOS) {
    const match = userAgent.match(/OS (\d+)_(\d+)/);
    if (match) {
      iosVersion = parseInt(match[1], 10);
    }
  }

  // Determine web push support
  const supportsWebPush = determineWebPushSupport(isIOS, isAndroid, browser, iosVersion);
  
  // iOS requires user gesture for permission request
  const requiresUserGesture = isIOS;

  return {
    isIOS,
    isAndroid,
    isMobile,
    isDesktop,
    browser,
    iosVersion,
    supportsWebPush,
    requiresUserGesture,
  };
}

/**
 * Determine if device supports web push notifications
 */
function determineWebPushSupport(
  isIOS: boolean,
  isAndroid: boolean,
  browser: string,
  iosVersion?: number
): boolean {
  // Android Chrome/Firefox/Edge: Supported
  if (isAndroid && ['chrome', 'firefox', 'edge'].includes(browser)) {
    return true;
  }

  // iOS Safari 16.4+: Supported (requires Apple Developer Account)
  if (isIOS && browser === 'safari' && iosVersion && iosVersion >= 16.4) {
    return true;
  }

  // iOS < 16.4: Not supported
  if (isIOS && iosVersion && iosVersion < 16.4) {
    return false;
  }

  // iOS Chrome/Firefox: Not supported (must use Safari)
  if (isIOS && ['chrome', 'firefox'].includes(browser)) {
    return false;
  }

  // Desktop browsers: Supported
  if (!isIOS && !isAndroid) {
    return true;
  }

  // Default: Not supported
  return false;
}

/**
 * Get user-friendly message about notification support
 */
export function getNotificationSupportMessage(deviceInfo: DeviceInfo): string {
  if (deviceInfo.supportsWebPush) {
    return 'Les notifications sont supportées sur votre appareil.';
  }

  if (deviceInfo.isIOS) {
    if (deviceInfo.iosVersion && deviceInfo.iosVersion < 16.4) {
      return 'Veuillez mettre à jour iOS vers 16.4+ pour recevoir les notifications.';
    }
    
    if (deviceInfo.browser !== 'safari') {
      return 'Veuillez utiliser Safari pour activer les notifications sur iOS.';
    }
    
    return 'Les notifications nécessitent un certificat Apple Developer (en cours de configuration).';
  }

  if (deviceInfo.isAndroid) {
    return 'Veuillez utiliser Chrome, Firefox ou Edge pour activer les notifications.';
  }

  return 'Les notifications ne sont pas supportées sur votre navigateur.';
}

/**
 * Check if device can request notification permission
 */
export function canRequestNotificationPermission(deviceInfo: DeviceInfo): boolean {
  // Must support web push and have user gesture capability
  return deviceInfo.supportsWebPush && 'Notification' in window;
}

/**
 * Get iOS-specific instructions for enabling notifications
 */
export function getIOSNotificationInstructions(): string[] {
  return [
    '1. Ouvrez Safari sur votre iPhone/iPad',
    '2. Allez sur pikdrive.com',
    '3. Appuyez sur le bouton "Partager" en bas',
    '4. Sélectionnez "Sur l\'écran d\'accueil"',
    '5. Ouvrez l\'application PikDrive depuis l\'écran d\'accueil',
    '6. Activez les notifications quand demandé'
  ];
}
