import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, createVerify } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Base64Url } from '../dist/packages/crypto/src/index.js';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildApiContext, buildApiRoutes } from '../dist/apps/api/src/routes.js';

function createRequest(method, path, query = {}, headers = {}, body) {
  return { method, path, query, headers, body };
}

test('oidc token endpoint issues signed RS256 tokens and jwks exposes only public keys', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-api-'));
  const issuer = 'https://issuer.example';
  const clientId = 'pubauth-client';
  const redirectUri = 'http://localhost:3000/callback';
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const context = await buildApiContext(issuer, dataDir);
  const routes = await buildApiRoutes(issuer, context);

  const authorizeRoute = findRoute(routes, 'GET', '/oauth2/authorize');
  const tokenRoute = findRoute(routes, 'POST', '/oauth2/token');
  const jwksRoute = findRoute(routes, 'GET', '/oauth2/jwks');
  const userinfoRoute = findRoute(routes, 'GET', '/oauth2/userinfo');
  const loginRoute = findRoute(routes, 'POST', '/auth/login');

  assert.ok(authorizeRoute);
  assert.ok(tokenRoute);
  assert.ok(jwksRoute);
  assert.ok(userinfoRoute);
  assert.ok(loginRoute);

  const sessionResponse = await loginRoute.handler(
    createRequest('POST', '/auth/login', {}, {}, {
      username: 'user@atlas.local',
      password: 'ChangeMe-User!1',
    }),
  );
  const cookie = sessionResponse.headers?.['set-cookie'];
  assert.equal(typeof cookie, 'string');

  const authorizeResponse = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url(verifier),
        code_challenge_method: 'S256',
      },
      {
        cookie,
      },
    ),
  );

  assert.equal(authorizeResponse.statusCode, 302);
  const redirect = new URL(authorizeResponse.body.redirect);
  const code = redirect.searchParams.get('code');
  assert.ok(code);

  const tokenResponse = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  );

  assert.equal(tokenResponse.statusCode, 200);
  assert.equal(tokenResponse.body.tokenType, 'Bearer');
  assert.equal(tokenResponse.body.scope, 'openid profile email');

  const accessToken = tokenResponse.body.accessToken;
  const idToken = tokenResponse.body.idToken;
  assert.ok(accessToken);
  assert.ok(idToken);

  const verifiedAccess = context.jwtSigner.verify(accessToken, {
    issuer,
    audience: clientId,
  });
  assert.equal(verifiedAccess.payload.iss, issuer);
  assert.equal(verifiedAccess.payload.aud, clientId);
  assert.equal(verifiedAccess.payload.sub, 'user-1');
  assert.equal(verifiedAccess.payload.token_use, 'access_token');
  assert.equal(typeof verifiedAccess.payload.exp, 'number');
  assert.ok(verifiedAccess.payload.exp > verifiedAccess.payload.iat);

  const verifiedId = context.jwtSigner.verify(idToken, {
    issuer,
    audience: clientId,
  });
  assert.equal(verifiedId.payload.token_use, 'id_token');

  const jwksResponse = await jwksRoute.handler(createRequest('GET', '/oauth2/jwks'));
  assert.deepEqual(jwksResponse.body, context.jwtSigner.jwks());
  assert.equal(jwksResponse.body.keys[0].n.includes('PRIVATE'), false);
  assert.equal(verifyJwtWithJwk(accessToken, jwksResponse.body.keys[0]), true);

  const userInfoResponse = await userinfoRoute.handler(
    createRequest('GET', '/oauth2/userinfo', {}, { authorization: `Bearer ${accessToken}` }),
  );

  assert.equal(userInfoResponse.statusCode, 200);
  assert.equal(userInfoResponse.body.sub, 'user-1');
  assert.equal(userInfoResponse.body.claims.client_id, clientId);

  const replayResponse = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  );

  assert.equal(replayResponse.statusCode, 400);
  assert.equal(replayResponse.body.error, 'invalid_grant');
});

test('authorize rejects header session spoofing and invalid protocol parameters', async () => {
  const previousEnv = process.env.PUBAUTH_ENV;
  process.env.PUBAUTH_ENV = 'local';
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-api-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);
  const authorizeRoute = findRoute(routes, 'GET', '/oauth2/authorize');
  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  assert.ok(authorizeRoute);
  assert.ok(loginRoute);

  const spoofedResponse = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url('verifier'),
        code_challenge_method: 'S256',
      },
      {
        'x-pubauth-session-id': 'session-123',
      },
    ),
  );
  assert.equal(spoofedResponse.statusCode, 401);
  assert.equal(spoofedResponse.body.error, 'login_required');

  const localDevHeaderResponse = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url('verifier-local-dev'),
        code_challenge_method: 'S256',
      },
      {
        'x-pubauth-dev-subject-id': 'admin-user',
        'x-pubauth-dev-workspace-id': 'workspace-core-platform',
      },
    ),
  );
  assert.equal(localDevHeaderResponse.statusCode, 302);

  const sessionResponse = await loginRoute.handler(
    createRequest('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  const cookie = sessionResponse.headers?.['set-cookie'];

  const invalidResponseType = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'token',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url('verifier-1'),
        code_challenge_method: 'S256',
      },
      { cookie },
    ),
  );
  assert.equal(invalidResponseType.statusCode, 400);
  assert.equal(invalidResponseType.body.error, 'unsupported_response_type');

  const invalidChallengeMethod = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url('verifier-2'),
        code_challenge_method: 'plain',
      },
      { cookie },
    ),
  );
  assert.equal(invalidChallengeMethod.statusCode, 400);
  assert.equal(invalidChallengeMethod.body.error, 'invalid_code_challenge_method');

  if (previousEnv === undefined) {
    delete process.env.PUBAUTH_ENV;
  } else {
    process.env.PUBAUTH_ENV = previousEnv;
  }
});

test('dev session header is rejected outside local mode', async () => {
  const previousEnv = process.env.PUBAUTH_ENV;
  process.env.PUBAUTH_ENV = 'prod';
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-api-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);
  const authorizeRoute = findRoute(routes, 'GET', '/oauth2/authorize');
  assert.ok(authorizeRoute);

  const response = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url('verifier-prod-dev-header'),
        code_challenge_method: 'S256',
      },
      {
        'x-pubauth-dev-subject-id': 'admin-user',
        'x-pubauth-dev-workspace-id': 'workspace-core-platform',
      },
    ),
  );
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'login_required');

  if (previousEnv === undefined) {
    delete process.env.PUBAUTH_ENV;
  } else {
    process.env.PUBAUTH_ENV = previousEnv;
  }
});

test('confidential clients require valid token endpoint authentication', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-api-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);
  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  const createProductRoute = findRoute(routes, 'POST', '/admin/products');
  const createClientRoute = findRoute(routes, 'POST', '/admin/clients');
  const authorizeRoute = findRoute(routes, 'GET', '/oauth2/authorize');
  const tokenRoute = findRoute(routes, 'POST', '/oauth2/token');
  assert.ok(loginRoute);
  assert.ok(createProductRoute);
  assert.ok(createClientRoute);
  assert.ok(authorizeRoute);
  assert.ok(tokenRoute);

  const sessionResponse = await loginRoute.handler(
    createRequest('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  const cookie = sessionResponse.headers?.['set-cookie'];

  const productResponse = await createProductRoute.handler(
    createRequest('POST', '/admin/products', {}, { cookie }, {
      workspaceId: 'workspace-core-platform',
      name: 'Nova',
      slug: 'nova',
      environment: 'dev',
    }),
  );
  assert.equal(productResponse.statusCode, 201);

  const clientResponse = await createClientRoute.handler(
    createRequest('POST', '/admin/clients', {}, { cookie }, {
      productId: productResponse.body.id,
      clientType: 'confidential',
      redirectUris: ['http://localhost:3000/callback'],
      scopes: ['profile', 'email'],
    }),
  );
  assert.equal(clientResponse.statusCode, 201);
  assert.equal(typeof clientResponse.body.clientSecret, 'string');

  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const authResponse = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: clientResponse.body.id,
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url(verifier),
        code_challenge_method: 'S256',
      },
      { cookie },
    ),
  );
  assert.equal(authResponse.statusCode, 302);
  const code = new URL(authResponse.body.redirect).searchParams.get('code');
  assert.ok(code);

  const missingSecret = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: clientResponse.body.id,
      redirect_uri: 'http://localhost:3000/callback',
      code,
      code_verifier: verifier,
    }),
  );
  assert.equal(missingSecret.statusCode, 400);
  assert.equal(missingSecret.body.error, 'invalid_client');

  const invalidSecret = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: clientResponse.body.id,
      redirect_uri: 'http://localhost:3000/callback',
      code,
      code_verifier: verifier,
      client_secret: 'wrong-secret',
    }),
  );
  assert.equal(invalidSecret.statusCode, 400);
  assert.equal(invalidSecret.body.error, 'invalid_client');
});

test('refresh token rotation revokes the family on replay reuse', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-api-'));
  const issuer = 'https://issuer.example';
  const redirectUri = 'http://localhost:3000/callback';
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const routes = await buildApiRoutes(issuer, dataDir);
  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  const authorizeRoute = findRoute(routes, 'GET', '/oauth2/authorize');
  const tokenRoute = findRoute(routes, 'POST', '/oauth2/token');
  assert.ok(loginRoute);
  assert.ok(authorizeRoute);
  assert.ok(tokenRoute);

  const sessionResponse = await loginRoute.handler(
    createRequest('POST', '/auth/login', {}, {}, {
      username: 'user@atlas.local',
      password: 'ChangeMe-User!1',
    }),
  );
  const cookie = sessionResponse.headers?.['set-cookie'];

  const authorizeResponse = await authorizeRoute.handler(
    createRequest(
      'GET',
      '/oauth2/authorize',
      {
        client_id: 'pubauth-client',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: sha256Base64Url(verifier),
        code_challenge_method: 'S256',
      },
      { cookie },
    ),
  );
  const code = new URL(authorizeResponse.body.redirect).searchParams.get('code');
  assert.ok(code);

  const initialTokenResponse = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: 'pubauth-client',
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  );
  assert.equal(initialTokenResponse.statusCode, 200);
  assert.equal(typeof initialTokenResponse.body.refreshToken, 'string');

  const firstRotation = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'refresh_token',
      client_id: 'pubauth-client',
      refresh_token: initialTokenResponse.body.refreshToken,
    }),
  );
  assert.equal(firstRotation.statusCode, 200);
  assert.equal(typeof firstRotation.body.refreshToken, 'string');

  const replayAttempt = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'refresh_token',
      client_id: 'pubauth-client',
      refresh_token: initialTokenResponse.body.refreshToken,
    }),
  );
  assert.equal(replayAttempt.statusCode, 400);
  assert.equal(replayAttempt.body.error, 'invalid_grant');

  const descendantUseAfterReplay = await tokenRoute.handler(
    createRequest('POST', '/oauth2/token', {}, {}, {
      grant_type: 'refresh_token',
      client_id: 'pubauth-client',
      refresh_token: firstRotation.body.refreshToken,
    }),
  );
  assert.equal(descendantUseAfterReplay.statusCode, 400);
  assert.equal(descendantUseAfterReplay.body.error, 'invalid_grant');
});

function verifyJwtWithJwk(token, jwk) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  return verifier.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(toBase64(encodedSignature), 'base64'));
}

function toBase64(value) {
  return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
}
