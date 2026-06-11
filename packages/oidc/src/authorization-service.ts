import { randomToken, sha256Hex } from '../../crypto/src/index.js';
import type { AuthorizationCodeStore } from './authorization-code.js';
import type { AuthorizationResponse, AuthenticatedAuthorizationRequest, AuthorizationService } from './authorize.js';
import { parseScopes } from './authorize.js';
import type { OidcClientRepository } from './client.js';
import { areScopesAllowed, isRedirectUriAllowed } from './client.js';

export class DefaultAuthorizationService implements AuthorizationService {
  constructor(
    private readonly clients: OidcClientRepository,
    private readonly codes: AuthorizationCodeStore,
  ) {}

  async start(request: AuthenticatedAuthorizationRequest): Promise<AuthorizationResponse> {
    const client = await this.clients.findByClientId(request.clientId);

    if (!client || !client.isActive) {
      throw new Error('invalid_client');
    }

    if (request.responseType !== 'code') {
      throw new Error('unsupported_response_type');
    }

    if (request.codeChallengeMethod !== 'S256') {
      throw new Error('invalid_code_challenge_method');
    }

    if (!isRedirectUriAllowed(client, request.redirectUri)) {
      throw new Error('invalid_redirect_uri');
    }

    const scopes = parseScopes(request.scope);
    if (!areScopesAllowed(client, scopes)) {
      throw new Error('invalid_scope');
    }

    const code = randomToken(32);
    await this.codes.save({
      codeHash: sha256Hex(code),
      clientId: request.clientId,
      subjectId: request.subjectId,
      workspaceId: request.workspaceId,
      sessionId: request.sessionId,
      redirectUri: request.redirectUri,
      scopes,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    return {
      redirectUri: request.redirectUri,
      code,
      state: request.state,
    };
  }
}
