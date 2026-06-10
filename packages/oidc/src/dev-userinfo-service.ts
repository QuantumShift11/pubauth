import type { JwtSigner } from '../../crypto/src/index.js';
import type { AccessTokenStore } from './token-store.js';
import type { UserInfoRequest, UserInfoResponse, UserInfoService } from './userinfo.js';

export class DevUserInfoService implements UserInfoService {
  constructor(
    private readonly accessTokens: AccessTokenStore,
    private readonly jwtSigner?: JwtSigner,
  ) {}

  async getUserInfo(request: UserInfoRequest): Promise<UserInfoResponse> {
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

      return {
        sub: String(verified.payload.sub),
        workspace: typeof verified.payload.workspace_id === 'string' ? verified.payload.workspace_id : undefined,
        roles: normalizeList(verified.payload.roles),
        groups: normalizeList(verified.payload.groups),
        claims: {
          client_id: clientId,
          scope: verified.payload.scope,
          workspace_id: verified.payload.workspace_id,
          token_use: 'access_token',
        },
      };
    }

    const token = await this.accessTokens.find(request.accessToken, new Date());
    if (!token) {
      throw new Error('invalid_token');
    }

    return {
      sub: token.subjectId,
      workspace: token.workspaceId,
      claims: {
        client_id: token.clientId,
        scope: token.scopes.join(' '),
        workspace_id: token.workspaceId,
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
