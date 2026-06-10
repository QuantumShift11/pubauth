import { randomUUID } from 'node:crypto';
import type { AuditRepository, SessionRepository } from '../../storage/src/index.js';
import type { StoredAuditEvent, StoredAuthSession, StoredUserAccount } from '../../storage/src/pubauth-state.js';
import type { OidcAdapterRegistry, ProviderProfile } from './provider.js';
import { BrokerStateService } from './state-service.js';
import { BrokerAccountLinkingService } from './account-linking-service.js';

export class BrokerAuthenticationService {
  constructor(
    private readonly registry: OidcAdapterRegistry,
    private readonly stateService: BrokerStateService,
    private readonly accountLinking: BrokerAccountLinkingService,
    private readonly sessions: SessionRepository<StoredAuthSession>,
    private readonly audit?: AuditRepository<StoredAuditEvent>,
  ) {}

  async start(provider: 'google' | 'entra', redirectUri: string, workspaceId?: string): Promise<{ redirectUrl: string }> {
    const adapter = this.getAdapter(provider);
    const brokerState = await this.stateService.issue(provider, redirectUri, workspaceId);
    const redirectUrl = await adapter.buildLoginUrl(brokerState.state, brokerState.nonce);
    return { redirectUrl };
  }

  async complete(
    provider: 'google' | 'entra',
    params: Record<string, string>,
  ): Promise<{ user: StoredUserAccount; session: StoredAuthSession; redirectUri?: string }> {
    const state = params.state;
    if (!state) {
      throw new Error('provider_state_missing');
    }

    const validation = await this.stateService.verify(state);
    if (!validation.valid || validation.provider !== provider) {
      throw new Error(validation.reason ?? 'provider_state_invalid');
    }

    const adapter = this.getAdapter(provider);
    const profile = await adapter.handleCallback(params, { expectedNonce: validation.nonce });
    const user = await this.accountLinking.resolveUser(profile, validation.workspaceId);
    const session = await this.createSession(user, profile);
    return { user, session, redirectUri: validation.redirectUri };
  }

  private getAdapter(provider: 'google' | 'entra') {
    const adapter = provider === 'google' ? this.registry.google : this.registry.entra;
    if (!adapter) {
      throw new Error('provider_not_configured');
    }
    return adapter;
  }

  private async createSession(user: StoredUserAccount, profile: ProviderProfile): Promise<StoredAuthSession> {
    const session: StoredAuthSession = {
      id: `session-${randomUUID().slice(0, 12)}`,
      subjectId: user.subjectId,
      workspaceId: user.workspaceId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };
    await this.sessions.save(session);
    await this.audit?.append({
      id: `audit-${randomUUID().slice(0, 12)}`,
      actor: user.subjectId,
      action: 'broker_login_completed',
      entityType: 'auth_session',
      entityId: session.id,
      workspaceId: user.workspaceId,
      outcome: 'success',
      description: `Broker login completed with ${profile.providerName}`,
      createdAt: new Date().toISOString(),
    });
    return session;
  }
}
