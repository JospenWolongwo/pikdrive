'use client';

import { useState } from 'react';
import { InstallPrompt } from './InstallPrompt';
import { IOSInstallPrompt } from './IOSInstallPrompt';
import { AndroidInstallPrompt } from './AndroidInstallPrompt';

export function PWAPrompts() {
  const [showIOS, setShowIOS] = useState(false);
  const [showAndroid, setShowAndroid] = useState(false);

  return (
    <>
      <IOSInstallPrompt 
        show={showIOS}
        onDismiss={() => setShowIOS(false)}
      />
      <AndroidInstallPrompt 
        show={showAndroid}
        onDismiss={() => setShowAndroid(false)}
        onInstall={() => {
          console.log('🤖 Installing from PWAPrompts');
          setShowAndroid(false);
        }}
      />
    </>
  );
}
