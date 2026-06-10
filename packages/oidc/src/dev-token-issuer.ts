import { randomToken, sha256Hex, type JwtSigner } from '../../crypto/src/index.js';
import type { AuthorizationCodeStore } from './authorization-code.js';
import type { TokenIssuer, TokenRequest, TokenResponse } from './token.js';
import { verifyPkceS256 } from './pkce.js';
import type { AccessTokenStore } from './token-store.js';

export class DevTokenIssuer implements TokenIssuer {
  constructor(
    private readonly codes: AuthorizationCodeStore,
    private readonly accessTokens?: AccessTokenStore,
    private readonly jwtSigner?: JwtSigner,
  ) {}

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

    const expiresIn = 3600;
    const accessToken = this.jwtSigner
      ? this.jwtSigner.sign({
          audience: code.clientId,
          subject: code.subjectId,
          expiresInSeconds: expiresIn,
          claims: {
            token_use: 'access_token',
            scope: code.scopes.join(' '),
            client_id: code.clientId,
          },
        })
      : randomToken(32);

    const idToken = this.jwtSigner
      ? this.jwtSigner.sign({
          audience: code.clientId,
          subject: code.subjectId,
          expiresInSeconds: expiresIn,
          claims: {
            token_use: 'id_token',
            scope: code.scopes.join(' '),
            client_id: code.clientId,
          },
        })
      : randomToken(32);

    await this.accessTokens?.save({
      accessToken,
      subjectId: code.subjectId,
      clientId: code.clientId,
      scopes: code.scopes,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });

    return {
      accessToken,
      idToken,
      refreshToken: randomToken(32),
      tokenType: 'Bearer',
      expiresIn,
      scope: code.scopes.join(' '),
    };
  }
}
