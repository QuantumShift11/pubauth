import { randomToken, sha256Hex, type JwtSigner } from '../../crypto/src/index.js';
import type { AuthorizationCodeStore } from './authorization-code.js';
import type { TokenIssuer, TokenRequest, TokenResponse } from './token.js';
import { verifyPkceS256 } from './pkce.js';
import type { AccessTokenStore } from './token-store.js';
import type { OidcClientRepository, OidcClient } from './client.js';
import { verifyClientSecret } from './client.js';
import type { RefreshTokenRepository } from '../../storage/src/index.js';
import type { StoredRefreshToken } from '../../storage/src/pubauth-state.js';

export class DevTokenIssuer implements TokenIssuer {
  constructor(
    private readonly codes: AuthorizationCodeStore,
    private readonly accessTokens?: AccessTokenStore,
    private readonly jwtSigner?: JwtSigner,
    private readonly claimResolver?: (request: { subjectId: string; workspaceId: string }) => Promise<Record<string, unknown>>,
    private readonly clients?: OidcClientRepository,
    private readonly refreshTokens?: RefreshTokenRepository<StoredRefreshToken>,
  ) {}

  async issueToken(request: TokenRequest): Promise<TokenResponse> {
    const client = await this.requireClient(request.clientId);
    this.assertClientAuthentication(client, request.clientSecret, request.clientAuthMethod);

    if (request.grantType === 'authorization_code') {
      return this.issueAuthorizationCodeToken(request, client);
    }

    if (request.grantType === 'refresh_token') {
      return this.issueRefreshToken(request, client);
    }

    throw new Error('unsupported_grant_type');
  }

  private async issueAuthorizationCodeToken(request: TokenRequest, client: OidcClient): Promise<TokenResponse> {
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

    return this.issueTokens({
      client,
      subjectId: code.subjectId,
      workspaceId: code.workspaceId,
      sessionId: code.sessionId,
      scopes: code.scopes,
    });
  }

  private async issueRefreshToken(request: TokenRequest, client: OidcClient): Promise<TokenResponse> {
    if (!request.refreshToken) {
      throw new Error('invalid_request');
    }

    if (!this.refreshTokens) {
      throw new Error('unsupported_grant_type');
    }

    const now = new Date();
    const token = await this.refreshTokens.find(request.refreshToken, now);
    if (!token || token.clientId !== request.clientId) {
      throw new Error('invalid_grant');
    }

    if (token.revokedAt || token.replacedByHash) {
      await this.refreshTokens.revokeFamily(token.familyId, now);
      throw new Error('invalid_grant');
    }

    const nextRefreshToken = randomToken(48);
    const nextRefreshTokenHash = sha256Hex(nextRefreshToken);
    const nextToken: StoredRefreshToken = {
      refreshTokenHash: nextRefreshTokenHash,
      familyId: token.familyId,
      subjectId: token.subjectId,
      clientId: token.clientId,
      workspaceId: token.workspaceId,
      sessionId: token.sessionId,
      scopes: [...token.scopes],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      parentRefreshTokenHash: token.refreshTokenHash,
    };

    await this.refreshTokens.save({
      ...token,
      rotatedAt: now.toISOString(),
      revokedAt: now.toISOString(),
      replacedByHash: nextRefreshTokenHash,
    });
    await this.refreshTokens.save(nextToken);

    const response = await this.issueTokens({
      client,
      subjectId: token.subjectId,
      workspaceId: token.workspaceId,
      sessionId: token.sessionId,
      scopes: token.scopes,
    });

    return {
      ...response,
      refreshToken: nextRefreshToken,
    };
  }

  private async issueTokens(request: { client: OidcClient; subjectId: string; workspaceId: string; sessionId?: string; scopes: string[] }): Promise<TokenResponse> {
    const expiresIn = 3600;
    const accessTokenId = `at-${randomToken(12)}`;
    const claims = {
      scope: request.scopes.join(' '),
      client_id: request.client.clientId,
      workspace_id: request.workspaceId,
      jti: accessTokenId,
      ...(request.sessionId ? { sid: request.sessionId } : {}),
      ...((await this.claimResolver?.({ subjectId: request.subjectId, workspaceId: request.workspaceId })) ?? {}),
    };

    const accessToken = this.jwtSigner
      ? this.jwtSigner.sign({
          audience: request.client.clientId,
          subject: request.subjectId,
          expiresInSeconds: expiresIn,
          claims: {
            token_use: 'access_token',
            ...claims,
          },
        })
      : randomToken(32);

    const idToken = this.jwtSigner
      ? this.jwtSigner.sign({
          audience: request.client.clientId,
          subject: request.subjectId,
          expiresInSeconds: expiresIn,
          claims: {
            token_use: 'id_token',
            ...claims,
          },
        })
      : randomToken(32);

    await this.accessTokens?.save({
      accessToken,
      jti: accessTokenId,
      subjectId: request.subjectId,
      clientId: request.client.clientId,
      workspaceId: request.workspaceId,
      sessionId: request.sessionId,
      scopes: request.scopes,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });

    const response: TokenResponse = {
      accessToken,
      idToken,
      tokenType: 'Bearer',
      expiresIn,
      scope: request.scopes.join(' '),
    };

    if (this.refreshTokens) {
      const refreshToken = randomToken(48);
      const refreshTokenHash = sha256Hex(refreshToken);
      const familyId = `family-${randomToken(12)}`;
      await this.refreshTokens.save({
        refreshTokenHash,
        familyId,
        subjectId: request.subjectId,
        clientId: request.client.clientId,
        workspaceId: request.workspaceId,
        sessionId: request.sessionId,
        scopes: [...request.scopes],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      response.refreshToken = refreshToken;
    }

    return response;
  }

  private async requireClient(clientId: string): Promise<OidcClient> {
    if (!this.clients) {
      return {
        clientId,
        clientType: 'public',
        tokenEndpointAuthMethod: 'none',
        allowedRedirectUris: [],
        allowedScopes: [],
        isActive: true,
      };
    }

    const client = await this.clients.findByClientId(clientId);
    if (!client || !client.isActive) {
      throw new Error('invalid_client');
    }

    return client;
  }

  private assertClientAuthentication(
    client: OidcClient,
    clientSecret: string | undefined,
    clientAuthMethod: TokenRequest['clientAuthMethod'],
  ): void {
    if (client.clientType === 'public') {
      if (clientSecret || clientAuthMethod) {
        throw new Error('invalid_client');
      }
      return;
    }

    if (!verifyClientSecret(client, clientSecret, clientAuthMethod)) {
      throw new Error('invalid_client');
    }
  }
}
