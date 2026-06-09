import { randomToken, sha256Hex } from '../../crypto/src/index.js';
import type { AuthorizationCodeStore } from './authorization-code.js';
import type { TokenIssuer, TokenRequest, TokenResponse } from './token.js';
import { verifyPkceS256 } from './pkce.js';

export class DevTokenIssuer implements TokenIssuer {
  constructor(private readonly codes: AuthorizationCodeStore) {}

  async issueToken(request: TokenRequest): Promise<TokenResponse> {
    if (request.grantType !== 'authorization_code') {
      throw new Error('unsupported_grant_type');
    }

    if (!request.code || !request.codeVerifier) {
      throw new Error('invalid_request');
    }

    const codeHash = sha256Hex(request.code);
    const code = await this.codes.findUsable(codeHash, new Date());
    if (!code) {
      throw new Error('invalid_grant');
    }

    if (code.clientId !== request.clientId) {
      throw new Error('invalid_client');
    }

    if (request.redirectUri && code.redirectUri !== request.redirectUri) {
      throw new Error('invalid_grant');
    }

    if (!verifyPkceS256(request.codeVerifier, code.codeChallenge)) {
      throw new Error('invalid_grant');
    }

    await this.codes.markUsed(codeHash, new Date());

    return {
      accessToken: randomToken(32),
      idToken: randomToken(32),
      refreshToken: randomToken(32),
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: code.scopes.join(' '),
    };
  }
}
