import type { AuthorizationCode, AuthorizationCodeStore } from './authorization-code.js';
import { isAuthorizationCodeUsable } from './authorization-code.js';

export class MemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly codes = new Map<string, AuthorizationCode>();

  async save(code: AuthorizationCode): Promise<void> {
    this.codes.set(code.codeHash, code);
  }

  async consume(codeHash: string, now = new Date()): Promise<AuthorizationCode | null> {
    const code = this.codes.get(codeHash);
    if (!code || !isAuthorizationCodeUsable(code, now)) {
      return null;
    }

    const consumed = { ...code, usedAt: now.toISOString() };
    this.codes.set(codeHash, consumed);
    return consumed;
  }
}
