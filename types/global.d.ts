declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
      VAPID_PRIVATE_KEY: string;
      [key: string]: string | undefined;
    }
  }

  interface Window {
    __oneSignalReady?: boolean;
    OneSignalDeferred?: Array<(OneSignal: IOneSignal) => void>;
    OneSignal?: IOneSignal;
  }

  /**
   * OneSignal SDK TypeScript Interface
   * Based on OneSignal Web SDK v16
   */
  interface IOneSignal {
    init(options: IOneSignalInitOptions): Promise<void>;
    login(externalId: string): Promise<void>;
    logout(): Promise<void>;
    Notifications: {
      permission: boolean;
      requestPermission(): Promise<boolean>;
      addEventListener(event: string, callback: (event: any) => void): void;
      removeEventListener(event: string, callback: (event: any) => void): void;
    };
    User: {
      getUser(): Promise<{ onesignalId?: string }>;
    };
  }

  interface IOneSignalInitOptions {
    readonly appId: string;
    readonly allowLocalhostAsSecureOrigin?: boolean;
    readonly serviceWorkerParam?: {
      readonly scope: string;
    };
    readonly serviceWorkerPath?: string;
    readonly path?: string;
    readonly notifyButton?: {
      readonly enable: boolean;
    };
    readonly promptOptions?: {
      readonly slidedown?: {
        readonly enabled: boolean;
      };
    };
    readonly safari_web_id?: string;
  }
}

export {};
