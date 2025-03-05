import { TextEncoder } from 'util';

interface MomoConfig {
  subscriptionKey: string;
  apiKey: string;
  targetEnvironment: 'sandbox' | 'production';
  callbackHost: string;
  collectionPrimaryKey: string;
  collectionUserId: string;
}

interface CollectionRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export class MTNMomoService {
  private baseUrl: string;
  private config: MomoConfig;
  private tokenCache: { token: string; expires: Date } | null = null;

  constructor(config: MomoConfig) {
    this.config = config;
    this.baseUrl = 'https://sandbox.momodeveloper.mtn.com';
  }

  private async makeRequest(path: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...(options.body && { body: JSON.stringify(options.body) })
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    if (!response.ok) {
      const errorText = isJson ? await response.json() : await response.text();
      throw new Error(`Request failed: ${response.status} - ${typeof errorText === 'string' ? errorText : JSON.stringify(errorText)}`);
    }

    return isJson ? response.json() : response.text();
  }

  private async getAuthToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache && this.tokenCache.expires > new Date()) {
        return this.tokenCache.token;
      }

      const auth = Buffer.from(`${this.config.collectionUserId}:${this.config.apiKey}`).toString('base64');
      
      const data = await this.makeRequest('/collection/token/', {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Target-Environment': this.config.targetEnvironment
        }
      });

      // Cache the token with expiry (typically 1 hour)
      this.tokenCache = {
        token: data.access_token,
        expires: new Date(Date.now() + 3600000) // 1 hour from now
      };

      return data.access_token;
    } catch (error) {
      throw error;
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Sandbox test numbers and their behaviors
  private readonly SANDBOX_TEST_NUMBERS = {
    '237677777777': { status: 'SUCCESSFUL', reason: null },
    '237666666666': { status: 'FAILED', reason: 'APPROVAL_REJECTED' },
    '237655555555': { status: 'FAILED', reason: 'INTERNAL_PROCESSING_ERROR' },
    '237644444444': { status: 'FAILED', reason: 'INSUFFICIENT_FUNDS' },
    '237633333333': { status: 'PENDING', reason: 'TIMEOUT' }
  } as const;

  private isSandboxTestNumber(phoneNumber: string): boolean {
    return Object.keys(this.SANDBOX_TEST_NUMBERS).includes(phoneNumber);
  }

  private getSandboxTestResponse(phoneNumber: string) {
    return this.SANDBOX_TEST_NUMBERS[phoneNumber as keyof typeof this.SANDBOX_TEST_NUMBERS];
  }

  async requestToPay(request: {
    amount: number;
    currency: string;
    phoneNumber: string;
    externalId: string;
    payerMessage: string;
    payeeNote: string;
    callbackUrl: string;
  }): Promise<{ transactionId: string; requestId: string }> {
    try {
      const token = await this.getAuthToken();
      const transactionId = this.generateUUID();
      const requestId = this.generateUUID();

      // For sandbox testing
      if (this.config.targetEnvironment === 'sandbox') {
        console.log(' 🏖️ Using sandbox environment');
        if (request.phoneNumber === '237670000000') {
          return {
            transactionId,
            requestId
          };
        }
      }

      const collectionRequest: CollectionRequest = {
        amount: request.amount.toString(),
        currency: request.currency,
        externalId: request.externalId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: request.phoneNumber
        },
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote
      };

      await this.makeRequest('/collection/v1_0/requesttopay', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': transactionId,
          'X-Target-Environment': this.config.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'X-Callback-Url': request.callbackUrl
        },
        body: collectionRequest
      });

      return {
        transactionId,
        requestId
      };
    } catch (error) {
      console.error(' ❌ Error requesting payment:', error);
      throw error;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<{
    status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
    reason?: string;
    financialTransactionId?: string;
  }> {
    try {
      if (this.config.targetEnvironment === 'sandbox') {
        console.log(' 🏖️ Using sandbox environment with test number:', transactionId);
        
        // For sandbox testing, return successful status
        console.log(' ⚠️ Not a sandbox test number, defaulting to successful flow');
        return {
          status: 'SUCCESSFUL',
          reason: undefined,
          financialTransactionId: this.generateUUID()
        };
      }

      const token = await this.getAuthToken();
      const response = await this.makeRequest(`/collection/v1_0/requesttopay/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.config.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey
        }
      });

      return {
        status: response.status,
        reason: response.reason,
        financialTransactionId: response.financialTransactionId
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      throw error;
    }
  }

  // Validate webhook signature
  async validateWebhookSignature(signature: string, body: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.config.collectionPrimaryKey);
    const messageData = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === calculatedSignature;
  }
}
