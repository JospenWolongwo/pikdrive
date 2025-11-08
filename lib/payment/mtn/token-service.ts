/**
 * MTN MOMO Token Service
 * Handles authentication token generation for Collection and Disbursement APIs
 */

interface TokenConfig {
  baseUrl: string;
  subscriptionKey: string;
  collectionUserId: string;
  collectionApiKey: string;
  disbursementApiUser?: string;
  disbursementApiKey?: string;
  disbursementSubscriptionKey?: string;
}

interface TokenResult {
  readonly access_token: string;
  readonly expires_at: Date;
}

export class MTNTokenService {
  private collectionTokenCache: TokenResult | null = null;
  private disbursementTokenCache: TokenResult | null = null;

  constructor(private readonly config: TokenConfig) {}

  /**
   * Generate collection (payin) token
   */
  async getCollectionToken(): Promise<string | null> {
    // Check cache
    if (
      this.collectionTokenCache &&
      this.collectionTokenCache.expires_at > new Date()
    ) {
      return this.collectionTokenCache.access_token;
    }

    try {
      const auth = Buffer.from(
        `${this.config.collectionUserId}:${this.config.collectionApiKey}`
      ).toString("base64");

      const response = await fetch(`${this.config.baseUrl}/collection/token/`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        this.collectionTokenCache = {
          access_token: data.access_token,
          expires_at: expiresAt,
        };

        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error("Error generating collection token:", error);
      return null;
    }
  }

  /**
   * Generate disbursement (payout) token
   */
  async getDisbursementToken(): Promise<string | null> {
    if (
      !this.config.disbursementApiUser ||
      !this.config.disbursementApiKey
    ) {
      console.error("Disbursement credentials not configured");
      return null;
    }

    // Check cache
    if (
      this.disbursementTokenCache &&
      this.disbursementTokenCache.expires_at > new Date()
    ) {
      return this.disbursementTokenCache.access_token;
    }

    try {
      const base64Encoded = Buffer.from(
        `${this.config.disbursementApiUser}:${this.config.disbursementApiKey}`
      ).toString("base64");

      const response = await fetch(`${this.config.baseUrl}/disbursement/token/`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key":
            this.config.disbursementSubscriptionKey || this.config.subscriptionKey,
          Authorization: `Basic ${base64Encoded}`,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        this.disbursementTokenCache = {
          access_token: data.access_token,
          expires_at: expiresAt,
        };

        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error("Error generating disbursement token:", error);
      return null;
    }
  }
}








