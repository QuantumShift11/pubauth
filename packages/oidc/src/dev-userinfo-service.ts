import type { AccessTokenStore } from './token-store.js';
import type { UserInfoRequest, UserInfoResponse, UserInfoService } from './userinfo.js';

export class DevUserInfoService implements UserInfoService {
  constructor(private readonly accessTokens: AccessTokenStore) {}

  async getUserInfo(request: UserInfoRequest): Promise<UserInfoResponse> {
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
