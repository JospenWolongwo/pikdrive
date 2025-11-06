/**
 * Orange Money Token Service
 * Handles OAuth token generation
 */

interface TokenConfig {
  tokenUrl: string;
  consumerUser: string;
  consumerSecret: string;
}

interface TokenResult {
  readonly access_token: string;
  readonly expires_at: Date;
}

export class OrangeTokenService {
  private tokenCache: TokenResult | null = null;

  constructor(private readonly config: TokenConfig) {}

  /**
   * Get OAuth token
   */
  async getToken(): Promise<string | null> {
    // Check cache
    if (this.tokenCache && this.tokenCache.expires_at > new Date()) {
      return this.tokenCache.access_token;
    }

    try {
      const base64Encoded = Buffer.from(
        `${this.config.consumerUser}:${this.config.consumerSecret}`
      ).toString("base64");

      const response = await fetch(`${this.config.tokenUrl}token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${base64Encoded}`,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      });

      if (response.status === 200) {
        const data = await response.json();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        this.tokenCache = {
          access_token: data.access_token,
          expires_at: expiresAt,
        };

        return data.access_token;
      }

      return null;
    } catch (error) {
      console.error("Error getting payment token:", error);
      return null;
    }
  }
}






