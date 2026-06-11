import type { AccessTokenStore, IssuedAccessToken } from './token-store.js';

export class MemoryAccessTokenStore implements AccessTokenStore {
  private readonly tokens = new Map<string, IssuedAccessToken>();

  async save(token: IssuedAccessToken): Promise<void> {
    this.tokens.set(token.accessToken, token);
  }

  async find(accessToken: string, now = new Date()): Promise<IssuedAccessToken | null> {
    const token = this.tokens.get(accessToken);
    if (!token) {
      return null;
    }

    if (token.revokedAt || new Date(token.expiresAt).getTime() <= now.getTime()) {
      return null;
    }

    return token;
  }
}
