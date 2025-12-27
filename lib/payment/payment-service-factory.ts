/**
 * Payment Service Factory
 * Centralizes service initialization to eliminate duplication
 */

import { MTNMomoService } from './mtn-momo-service';
import { OrangeMoneyService } from './orange-money-service';
import { PawaPayService } from './pawapay/pawapay-service';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl } from '@/types/payment-ext';

export class PaymentServiceFactory {
  /**
   * Create MTN MoMo service for payment checking
   */
  static createMTNServiceForPayments(): MTNMomoService {
    return new MTNMomoService({
      subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
      apiKey: process.env.MOMO_API_KEY!,
      targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      callbackHost: process.env.MOMO_CALLBACK_HOST!,
      collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
      collectionUserId: process.env.MOMO_COLLECTION_USER_ID!,
    });
  }

  /**
   * Create MTN MoMo service for payout checking (includes disbursement config)
   */
  static createMTNServiceForPayouts(): MTNMomoService {
    return new MTNMomoService({
      subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY || '',
      apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY || '',
      targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      callbackHost: process.env.MOMO_CALLBACK_HOST || process.env.NEXT_PUBLIC_APP_URL || '',
      collectionPrimaryKey: process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || process.env.MOMO_COLLECTION_PRIMARY_KEY || '',
      collectionUserId: process.env.DIRECT_MOMO_COLLECTION_USER_ID || process.env.MOMO_COLLECTION_USER_ID || '',
      disbursementApiUser: process.env.DIRECT_MOMO_API_USER_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_USER,
      disbursementApiKey: process.env.DIRECT_MOMO_API_KEY_DISBURSMENT || process.env.MOMO_DISBURSEMENT_API_KEY,
      disbursementSubscriptionKey: process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY || process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY,
    });
  }

  /**
   * Create Orange Money service
   */
  static createOrangeMoneyService(): OrangeMoneyService {
    return new OrangeMoneyService({
      merchantId: process.env.DIRECT_OM_MERCHAND_NUMBER || process.env.ORANGE_MONEY_MERCHANT_ID || '',
      merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
      environment: (process.env.DIRECT_OM_ENVIRONMENT || process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      notificationUrl: process.env.DIRECT_OM_CALLBACK_URL || process.env.ORANGE_MONEY_NOTIFICATION_URL || '',
      returnUrl: process.env.ORANGE_MONEY_RETURN_URL || '',
      consumerUser: process.env.DIRECT_OM_CONSUMER_USER,
      consumerSecret: process.env.DIRECT_OM_CONSUMER_SECRET,
      apiUsername: process.env.DIRECT_OM_API_USERNAME,
      apiPassword: process.env.DIRECT_OM_API_PASSWORD,
      pinCode: process.env.DIRECT_OM_PIN_CODE,
      merchantNumber: process.env.DIRECT_OM_MERCHAND_NUMBER,
      tokenUrl: process.env.DIRECT_OM_TOKEN_URL,
      baseUrl: process.env.DIRECT_OM_BASE_URL,
    });
  }

  /**
   * Create pawaPay service
   */
  static createPawaPayService(): PawaPayService {
    return new PawaPayService({
      apiToken: process.env.PAWAPAY_API_TOKEN || '',
      baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/callbacks/pawapay`,
      environment: (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
    });
  }
}



