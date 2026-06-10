import { randomUUID } from 'node:crypto';
import { verifyPassword } from '../../crypto/src/index.js';
import type { AuditRepository, SessionRepository, UserRepository } from '../../storage/src/index.js';
import type { StoredAuditEvent, StoredAuthSession, StoredUserAccount } from '../../storage/src/pubauth-state.js';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResult {
  session: StoredAuthSession;
  user: StoredUserAccount;
}

export class LocalAccountSessionService {
  constructor(
    private readonly users: UserRepository<StoredUserAccount>,
    private readonly sessions: SessionRepository<StoredAuthSession>,
    private readonly audit?: AuditRepository<StoredAuditEvent>,
    private readonly environment: 'local' | 'dev' | 'qa' | 'prod' = 'local',
  ) {}

  async login(request: LoginRequest): Promise<LoginResult> {
    const username = request.username.trim().toLowerCase();
    const user = await this.users.findByUsername(username);
    if (user?.bootstrapAccount && this.environment !== 'local') {
      await this.writeAuditEvent('login_failed', username, user.workspaceId, 'failure', 'Bootstrap account disabled outside local mode');
      throw new Error('bootstrap_accounts_disabled');
    }
    if (!user || !verifyPassword(request.password, user.passwordHash)) {
      await this.writeAuditEvent('login_failed', username, undefined, 'failure', 'Local login failed');
      throw new Error('invalid_credentials');
    }

    const session: StoredAuthSession = {
      id: `session-${randomUUID().slice(0, 12)}`,
      subjectId: user.subjectId,
      workspaceId: user.workspaceId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };
    await this.sessions.save(session);
    await this.users.save({
      ...user,
      lastLoginAt: new Date().toISOString(),
    });
    await this.writeAuditEvent('login_completed', user.subjectId, user.workspaceId, 'success', `Local login for ${user.username}`);

    return { session, user };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, 'logout');
  }

  private async writeAuditEvent(
    action: string,
    actor: string,
    workspaceId: string | undefined,
    outcome: 'success' | 'failure',
    description: string,
  ): Promise<void> {
    if (!this.audit) {
      return;
    }

    await this.audit.append({
      id: `audit-${randomUUID().slice(0, 12)}`,
      actor,
      action,
      entityType: 'auth_session',
      entityId: actor,
      workspaceId,
      outcome,
      description,
      createdAt: new Date().toISOString(),
    });
  }
}
