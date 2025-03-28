'use client';

import { useState, useEffect } from 'react';

interface DeviceInfo {
  userAgent: string;
  isIOSDevice: boolean;
  isAndroidDevice: boolean;
  isMobileDevice: boolean;
  isDesktopDevice: boolean;
  isInstallable: boolean;
  hasPrompt: boolean;
  isStandalone: boolean;
}

export function useDeviceDetect() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    userAgent: '',
    isIOSDevice: false,
    isAndroidDevice: false,
    isMobileDevice: false,
    isDesktopDevice: true,
    isInstallable: false,
    hasPrompt: false,
    isStandalone: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      
      // Check for iOS devices (iPhone, iPad, iPod)
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
      
      // Check for Android devices
      const isAndroidDevice = /android/.test(userAgent);
      
      // Check if mobile (iOS, Android, or other mobile OS)
      const isMobileDevice = isIOSDevice || isAndroidDevice || /windows phone|blackberry|opera mini|mobile/.test(userAgent);
      
      // Desktop is not mobile
      const isDesktopDevice = !isMobileDevice;
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (navigator as any).standalone === true;

      setDeviceInfo({
        userAgent,
        isIOSDevice,
        isAndroidDevice,
        isMobileDevice,
        isDesktopDevice,
        isInstallable: !isStandalone && (isIOSDevice || isAndroidDevice),
        hasPrompt: false,
        isStandalone
      });

      console.log('📱 Device Detection:', {
        userAgent,
        isIOSDevice,
        isAndroidDevice,
        isMobileDevice,
        isDesktopDevice,
        isInstallable: !isStandalone && (isIOSDevice || isAndroidDevice),
        hasPrompt: false,
        isStandalone
      });
    }
  }, []);

  return deviceInfo;
}
