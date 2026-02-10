/**
 * Extended payment types matching MOMO_OM_PAYMENT_ABSTRUCTION.md
 * Unified types for MTN MOMO and Orange Money payment flows
 */

export interface PaymentApiRequest {
  readonly phoneNumber: string;
  readonly amount: number;
  readonly reason: string;
}

export interface PaymentServiceResponse {
  readonly success: boolean;
  readonly message: string;
  readonly verificationToken: string | null;
  readonly apiResponse: any;
}

export interface CheckPaymentServiceResponse {
  readonly success: boolean;
  readonly message: string;
  readonly status: number;
  readonly transactionStatus: string | null;
  readonly transactionAmount: number | null;
  readonly apiResponse: any;
}

export interface PayoutRequest {
  readonly phoneNumber: string;
  readonly amount: number;
  readonly reason: string;
  readonly customerName?: string;
  readonly currency: string;
  readonly userId?: string;
}

export interface RefundRequest {
  readonly phoneNumber: string; // Phone that made the payment
  readonly amount: number;
  readonly reason: string;
  readonly originalPaymentId: string; // Primary payment being refunded
  readonly currency: string;
  readonly bookingId: string;
  readonly userId?: string;
}

export interface RefundServiceResponse {
  readonly success: boolean;
  readonly message: string;
  readonly refundId: string | null; // Provider's transaction ID
  readonly apiResponse: any;
}

export const ENUM_CHECK_PAYMENT_TRANSACTION_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  ERROR: "ERROR",
  UNKNOWN: "UNKNOWN",
} as const;

export type CheckPaymentTransactionStatus =
  typeof ENUM_CHECK_PAYMENT_TRANSACTION_STATUS[keyof typeof ENUM_CHECK_PAYMENT_TRANSACTION_STATUS];

// MTN MOMO provider status values
export const MtnMomoStatus = {
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
} as const;

export type MtnMomoStatus = typeof MtnMomoStatus[keyof typeof MtnMomoStatus];

// Orange Money provider status values (includes typo variants from their API)
export const OrangeMoneyStatus = {
  SUCCESSFUL: 'SUCCESSFUL',
  SUCCESSFULL: 'SUCCESSFULL', // Orange Money API typo
  FAILED: 'FAILED',
  FAIL: 'FAIL', // Orange Money API variation
  PENDING: 'PENDING',
} as const;

export type OrangeMoneyStatus = typeof OrangeMoneyStatus[keyof typeof OrangeMoneyStatus];

export const HTTP_CODE = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  UNKNOWN: 600,
} as const;

// pawaPay provider status values
export const PawaPayStatus = {
  COMPLETED: 'COMPLETED',
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  FAILURE: 'FAILURE',
  REJECTED: 'REJECTED',
  ACCEPTED: 'ACCEPTED',
  SUBMITTED: 'SUBMITTED',
  PROCESSING: 'PROCESSING',
  ENQUEUED: 'ENQUEUED',
  PENDING: 'PENDING',
  FOUND: 'FOUND', 
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
} as const;

export type PawaPayStatus = typeof PawaPayStatus[keyof typeof PawaPayStatus];

// Currency codes
export const Currency = {
  EUR: 'EUR',
  XAF: 'XAF',
  USD: 'USD',
} as const;

export type Currency = typeof Currency[keyof typeof Currency];

// Environment types
export const Environment = {
  SANDBOX: 'sandbox',
  PRODUCTION: 'production',
} as const;

export type Environment = typeof Environment[keyof typeof Environment];

// pawaPay API endpoints
export const PawaPayEndpoint = {
  DEPOSITS: '/v2/deposits',
  PAYOUTS: '/v2/payouts',
} as const;

export type PawaPayEndpoint = typeof PawaPayEndpoint[keyof typeof PawaPayEndpoint];

// HTTP methods
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const;

export type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];

// HTTP headers
export const HttpHeader = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
} as const;

export type HttpHeader = typeof HttpHeader[keyof typeof HttpHeader];

// Content types
export const ContentType = {
  JSON: 'application/json',
} as const;

export type ContentType = typeof ContentType[keyof typeof ContentType];

// Authorization schemes
export const AuthScheme = {
  BEARER: 'Bearer',
} as const;

export type AuthScheme = typeof AuthScheme[keyof typeof AuthScheme];

// Country codes
export const CountryCode = {
  CAMEROON: '237',
} as const;

export type CountryCode = typeof CountryCode[keyof typeof CountryCode];

// Transaction types
export const TransactionType = {
  DEPOSIT: 'deposit',
  PAYOUT: 'payout',
} as const;

export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

// Sandbox constants
export const SandboxConfig = {
  DEFAULT_AMOUNT: 2,
  DEFAULT_CURRENCY: Currency.EUR,
} as const;

// pawaPay API base URLs
export const PawaPayApiUrl = {
  PRODUCTION: 'https://api.pawapay.io',
  SANDBOX: 'https://api.sandbox.pawapay.io',
} as const;

export type PawaPayApiUrl = typeof PawaPayApiUrl[keyof typeof PawaPayApiUrl];

// Feature flags
export const FeatureFlag = {
  USE_PAWAPAY: 'true',
} as const;

export type FeatureFlag = typeof FeatureFlag[keyof typeof FeatureFlag];


