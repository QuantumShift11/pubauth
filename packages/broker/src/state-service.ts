import { randomUUID } from 'node:crypto';
import type { BrokerStateRepository } from '../../storage/src/index.js';
import type { StoredBrokerState } from '../../storage/src/pubauth-state.js';
import type { BrokerSessionStart, BrokerStateValidation, StateNonceValidator } from './provider.js';

export class BrokerStateService implements StateNonceValidator {
  constructor(
    private readonly repository: BrokerStateRepository<StoredBrokerState>,
    private readonly expiresInSeconds = 300,
  ) {}

  async issue(provider: 'google' | 'entra', redirectUri: string, workspaceId?: string): Promise<BrokerSessionStart> {
    const state = randomUUID();
    const nonce = randomUUID();
    const now = Date.now();
    await this.repository.save({
      state,
      provider,
      nonce,
      redirectUri,
      workspaceId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.expiresInSeconds * 1000).toISOString(),
    });

    return {
      state,
      nonce,
      redirectUrl: redirectUri,
    };
  }

  async verify(state: string, nonce?: string): Promise<BrokerStateValidation> {
    const record = await this.repository.consume(state, new Date());
    if (!record) {
      return { valid: false, reason: 'missing' };
    }

    if (nonce && record.nonce !== nonce) {
      return { valid: false, reason: 'nonce_mismatch' };
    }

    return {
      valid: true,
      provider: record.provider,
      nonce: record.nonce,
      workspaceId: record.workspaceId,
      redirectUri: record.redirectUri,
    };
  }
}
