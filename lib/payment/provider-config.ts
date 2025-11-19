import type { PaymentProviderType } from './types';

export interface PaymentProviderConfig {
  readonly name: PaymentProviderType;
  readonly displayName: string;
  readonly logo: string;
  readonly testNumbers: readonly string[];
  readonly prefixes: readonly string[];
  readonly description: string;
  readonly minimumAmount: number;
  readonly maximumAmount: number;
  readonly processingFee: number;
  readonly processingTime: string;
}

export const PAYMENT_PROVIDERS: readonly PaymentProviderConfig[] = [
  {
    name: 'mtn',
    displayName: 'MTN Mobile Money',
    logo: '/images/payment-providers/mtn.png',
    testNumbers: ['237670000000'],
    prefixes: ['67'],
    description: 'Fast and secure payments with MTN Mobile Money',
    minimumAmount: 100,
    maximumAmount: 500000,
    processingFee: 0,
    processingTime: '1-2 minutes',
  },
  {
    name: 'orange',
    displayName: 'Orange Money',
    logo: '/images/payment-providers/orange.png',
    testNumbers: ['237699000001', '237699000002'],
    prefixes: ['69'],
    description: 'Quick and reliable payments with Orange Money',
    minimumAmount: 100,
    maximumAmount: 500000,
    processingFee: 0,
    processingTime: '1-2 minutes',
  },
] as const;

/**
 * Get all available payment providers
 */
export function getAvailableProviders(): readonly PaymentProviderConfig[] {
  return PAYMENT_PROVIDERS;
}

/**
 * Get a specific provider by name
 */
export function getProvider(name: PaymentProviderType): PaymentProviderConfig | undefined {
  return PAYMENT_PROVIDERS.find(p => p.name === name);
}












