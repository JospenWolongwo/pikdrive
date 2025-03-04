'use client';

import { InstallPrompt } from './InstallPrompt';
import { IOSInstallPrompt } from './IOSInstallPrompt';

export function PWAPrompts() {
  return (
    <>
      <InstallPrompt />
      <IOSInstallPrompt />
    </>
  );
}
