import test from 'node:test';
import assert from 'node:assert/strict';
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

  assert.ok(authorizeRoute);
  assert.ok(tokenRoute);
  assert.ok(jwksRoute);
  assert.ok(userinfoRoute);

  const authorizeResponse = await authorizeRoute.handler(
    createRequest('GET', '/oauth2/authorize', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: 'S256',
      subject_id: 'user-1',
      workspace_id: 'workspace-1',
    }),
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
