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
      const verified = this.jwtSigner.verify(request.accessToken, { issuer: this.jwtSigner.issuer });
      if (verified.payload.token_use !== 'access') {
        throw new Error('invalid_token_use');
      }

      return {
        sub: String(verified.payload.sub),
        claims: {
          client_id: verified.payload.aud,
          scope: verified.payload.scope,
        },
      };
    }

    const token = await this.accessTokens.find(request.accessToken, new Date());
    if (!token) {
      throw new Error('invalid_token');
    }

    return {
      sub: token.subjectId,
      claims: {
        client_id: token.clientId,
        scope: token.scopes.join(' '),
      },
    };
  }
}
