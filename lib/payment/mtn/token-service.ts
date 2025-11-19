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
    console.log("🔐 [TOKEN] getCollectionToken() called");
    
    // Check cache
    if (
      this.collectionTokenCache &&
      this.collectionTokenCache.expires_at > new Date()
    ) {
      console.log("✅ [TOKEN] Using cached collection token");
      return this.collectionTokenCache.access_token;
    }

    // Validate credentials before attempting token generation
    const missingCredentials: string[] = [];
    if (!this.config.collectionUserId) {
      missingCredentials.push("collectionUserId");
    }
    if (!this.config.collectionApiKey) {
      missingCredentials.push("collectionApiKey");
    }
    if (!this.config.subscriptionKey) {
      missingCredentials.push("subscriptionKey");
    }
    
    if (missingCredentials.length > 0) {
      console.error("❌ [TOKEN] Collection credentials not configured:", {
        missing: missingCredentials,
        config: {
          collectionUserId: this.config.collectionUserId ? `${this.config.collectionUserId.substring(0, 4)}...` : null,
          collectionApiKey: this.config.collectionApiKey ? `${this.config.collectionApiKey.substring(0, 4)}...` : null,
          subscriptionKey: this.config.subscriptionKey ? `${this.config.subscriptionKey.substring(0, 4)}...` : null,
        },
        available: {
          collectionUserId: !!this.config.collectionUserId,
          collectionApiKey: !!this.config.collectionApiKey,
          subscriptionKey: !!this.config.subscriptionKey,
        },
      });
      return null;
    }

    console.log("✅ [TOKEN] Collection credentials check passed");

    try {
      const auth = Buffer.from(
        `${this.config.collectionUserId}:${this.config.collectionApiKey}`
      ).toString("base64");

      const tokenUrl = `${this.config.baseUrl}/collection/token/`;

      console.log("🔐 [TOKEN] Attempting to generate collection token:", {
        url: tokenUrl,
        baseUrl: this.config.baseUrl,
        hasSubscriptionKey: !!this.config.subscriptionKey,
        hasCollectionUserId: !!this.config.collectionUserId,
        hasCollectionApiKey: !!this.config.collectionApiKey,
      });

      const response = await fetch(tokenUrl, {
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

        console.log("✅ [TOKEN] Collection token generated successfully");
        return data.access_token;
      }

      // Enhanced error logging for non-200 responses
      let errorBody: any = null;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
      } catch (parseError) {
        console.warn("⚠️ [TOKEN] Could not parse error response body:", parseError);
      }

      console.error("❌ [TOKEN] Failed to generate collection token:", {
        status: response.status,
        statusText: response.statusText,
        url: tokenUrl,
        headers: {
          contentType: response.headers.get("content-type"),
          hasAuthHeader: true,
          hasSubscriptionKey: !!this.config.subscriptionKey,
        },
        errorBody: errorBody,
        requestDetails: {
          method: "POST",
          baseUrl: this.config.baseUrl,
          endpoint: "/collection/token/",
        },
      });

      return null;
    } catch (error) {
      console.error("❌ [TOKEN] Exception generating collection token:", {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
        url: `${this.config.baseUrl}/collection/token/`,
        baseUrl: this.config.baseUrl,
        hasCredentials: {
          collectionUserId: !!this.config.collectionUserId,
          collectionApiKey: !!this.config.collectionApiKey,
          subscriptionKey: !!this.config.subscriptionKey,
        },
      });
      return null;
    }
  }

  /**
   * Generate disbursement (payout) token
   */
  async getDisbursementToken(): Promise<string | null> {
    console.log("🔐 [TOKEN] getDisbursementToken() called");
    
    // Enhanced credential validation with detailed logging
    const missingCredentials: string[] = [];
    if (!this.config.disbursementApiUser) {
      missingCredentials.push("disbursementApiUser");
    }
    if (!this.config.disbursementApiKey) {
      missingCredentials.push("disbursementApiKey");
    }
    
    if (missingCredentials.length > 0) {
      console.error("❌ [TOKEN] Disbursement credentials not configured:", {
        missing: missingCredentials,
        config: {
          disbursementApiUser: this.config.disbursementApiUser ? `${this.config.disbursementApiUser.substring(0, 4)}...` : null,
          disbursementApiKey: this.config.disbursementApiKey ? `${this.config.disbursementApiKey.substring(0, 4)}...` : null,
          disbursementSubscriptionKey: this.config.disbursementSubscriptionKey ? `${this.config.disbursementSubscriptionKey.substring(0, 4)}...` : null,
          subscriptionKey: this.config.subscriptionKey ? `${this.config.subscriptionKey.substring(0, 4)}...` : null,
        },
        available: {
          disbursementApiUser: !!this.config.disbursementApiUser,
          disbursementApiKey: !!this.config.disbursementApiKey,
          disbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
          subscriptionKey: !!this.config.subscriptionKey,
        },
      });
      return null;
    }
    
    console.log("✅ [TOKEN] Credentials check passed, proceeding with token generation");

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

      const tokenUrl = `${this.config.baseUrl}/disbursement/token/`;
      const subscriptionKey = this.config.disbursementSubscriptionKey || this.config.subscriptionKey;

      console.log("🔐 [TOKEN] Attempting to generate disbursement token:", {
        url: tokenUrl,
        baseUrl: this.config.baseUrl,
        hasSubscriptionKey: !!subscriptionKey,
        hasDisbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
        hasApiUser: !!this.config.disbursementApiUser,
        hasApiKey: !!this.config.disbursementApiKey,
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": subscriptionKey,
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

        console.log("✅ [TOKEN] Disbursement token generated successfully");
        return data.access_token;
      }

      // Enhanced error logging for non-200 responses
      let errorBody: any = null;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
      } catch (parseError) {
        console.warn("⚠️ [TOKEN] Could not parse error response body:", parseError);
      }

      console.error("❌ [TOKEN] Failed to generate disbursement token:", {
        status: response.status,
        statusText: response.statusText,
        url: tokenUrl,
        headers: {
          contentType: response.headers.get("content-type"),
          subscriptionKeyUsed: !!subscriptionKey,
        },
        errorBody: errorBody,
        requestDetails: {
          method: "POST",
          baseUrl: this.config.baseUrl,
          hasDisbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
        },
      });

      return null;
    } catch (error) {
      console.error("❌ [TOKEN] Exception generating disbursement token:", {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
        url: `${this.config.baseUrl}/disbursement/token/`,
        baseUrl: this.config.baseUrl,
        hasCredentials: {
          apiUser: !!this.config.disbursementApiUser,
          apiKey: !!this.config.disbursementApiKey,
          subscriptionKey: !!(this.config.disbursementSubscriptionKey || this.config.subscriptionKey),
        },
      });
      return null;
    }
  }
}










