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


