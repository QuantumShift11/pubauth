import type { AuthorizationCode, AuthorizationCodeStore } from './authorization-code.js';
import { isAuthorizationCodeUsable } from './authorization-code.js';

export class MemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly codes = new Map<string, AuthorizationCode>();

  async save(code: AuthorizationCode): Promise<void> {
    this.codes.set(code.codeHash, code);
  }

  async findUsable(codeHash: string, now = new Date()): Promise<AuthorizationCode | null> {
    const code = this.codes.get(codeHash);
    if (!code || !isAuthorizationCodeUsable(code, now)) {
      return null;
    }
    return code;
  }

  async markUsed(codeHash: string, now = new Date()): Promise<void> {
    const code = this.codes.get(codeHash);
    if (code) {
      this.codes.set(codeHash, { ...code, usedAt: now.toISOString() });
    }
  }

  async consume(codeHash: string, now = new Date()): Promise<AuthorizationCode | null> {
    const code = await this.findUsable(codeHash, now);
    if (!code) {
      return null;
    }
    await this.markUsed(codeHash, now);
    return code;
  }
}
