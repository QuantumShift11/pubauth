import type { JwtSigner } from '../../crypto/src/index.js';
import type { AccessTokenStore } from './token-store.js';
import type { UserInfoRequest, UserInfoResponse, UserInfoService } from './userinfo.js';
import type { SessionRepository } from '../../storage/src/index.js';
import type { StoredAuthSession } from '../../storage/src/pubauth-state.js';

export class DevUserInfoService implements UserInfoService {
  constructor(
    private readonly accessTokens: AccessTokenStore,
    private readonly jwtSigner?: JwtSigner,
    private readonly sessions?: SessionRepository<StoredAuthSession>,
  ) {}

  async getUserInfo(request: UserInfoRequest): Promise<UserInfoResponse> {
    const tokenRecord = await this.accessTokens.find(request.accessToken, new Date());
    if (!tokenRecord) {
      throw new Error('invalid_token');
    }

    if (tokenRecord.sessionId && this.sessions) {
      const session = await this.sessions.getById(tokenRecord.sessionId);
      if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
        throw new Error('invalid_token');
      }
    }

    if (this.jwtSigner) {
      const verified = this.jwtSigner.verify(request.accessToken, {
        issuer: this.jwtSigner.issuer,
        tokenUse: 'access_token',
      });

      const clientId = typeof verified.payload.client_id === 'string' ? verified.payload.client_id : null;
      if (!clientId) {
        throw new Error('invalid_token_audience');
      }

      const audience = Array.isArray(verified.payload.aud) ? verified.payload.aud : [verified.payload.aud];
      if (!audience.includes(clientId)) {
        throw new Error('invalid_token_audience');
      }

      if (typeof verified.payload.jti !== 'string' || verified.payload.jti !== tokenRecord.jti) {
        throw new Error('invalid_token');
      }

      if (tokenRecord.sessionId && verified.payload.sid !== tokenRecord.sessionId) {
        throw new Error('invalid_token');
      }

      return {
        sub: String(verified.payload.sub),
        workspace: typeof verified.payload.workspace_id === 'string' ? verified.payload.workspace_id : undefined,
        roles: normalizeList(verified.payload.roles),
        groups: normalizeList(verified.payload.groups),
        claims: {
          client_id: clientId,
          scope: verified.payload.scope,
          workspace_id: verified.payload.workspace_id,
          jti: tokenRecord.jti,
          token_use: 'access_token',
        },
      };
    }

    return {
      sub: tokenRecord.subjectId,
      workspace: tokenRecord.workspaceId,
      claims: {
        client_id: tokenRecord.clientId,
        scope: tokenRecord.scopes.join(' '),
        workspace_id: tokenRecord.workspaceId,
        jti: tokenRecord.jti,
        token_use: 'access_token',
      },
    };
  }
}

function normalizeList(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return [...value];
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return undefined;
}
