import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Base64Url } from '../dist/packages/crypto/src/index.js';
import {
  DefaultAuthorizationService,
  DevTokenIssuer,
  DevUserInfoService,
  MemoryAccessTokenStore,
  MemoryAuthorizationCodeStore,
  MemoryOidcClientRepository,
} from '../dist/packages/oidc/src/index.js';

test('dev authorization code flow exchanges a code once using PKCE and supports UserInfo', async () => {
  const codes = new MemoryAuthorizationCodeStore();
  const accessTokens = new MemoryAccessTokenStore();
  const clients = new MemoryOidcClientRepository([
    {
      clientId: 'test-client',
      clientType: 'public',
      allowedRedirectUris: ['http://localhost/callback'],
      allowedScopes: ['openid', 'profile'],
      isActive: true,
    },
  ]);

  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const authorization = new DefaultAuthorizationService(clients, codes);
  const tokenIssuer = new DevTokenIssuer(codes, accessTokens);
  const userInfo = new DevUserInfoService(accessTokens);

  const authResponse = await authorization.start({
    clientId: 'test-client',
    redirectUri: 'http://localhost/callback',
    responseType: 'code',
    scope: 'openid profile',
    codeChallenge: sha256Base64Url(verifier),
    codeChallengeMethod: 'S256',
    subjectId: 'user-1',
    workspaceId: 'workspace-1',
  });

  const tokenResponse = await tokenIssuer.issueToken({
    grantType: 'authorization_code',
    clientId: 'test-client',
    redirectUri: 'http://localhost/callback',
    code: authResponse.code,
    codeVerifier: verifier,
  });

  assert.equal(tokenResponse.tokenType, 'Bearer');
  assert.equal(tokenResponse.scope, 'openid profile');
  assert.ok(tokenResponse.accessToken);

  const profile = await userInfo.getUserInfo({ accessToken: tokenResponse.accessToken });
  assert.equal(profile.sub, 'user-1');
  assert.equal(profile.claims?.client_id, 'test-client');

  await assert.rejects(
    () => tokenIssuer.issueToken({
      grantType: 'authorization_code',
      clientId: 'test-client',
      redirectUri: 'http://localhost/callback',
      code: authResponse.code,
      codeVerifier: verifier,
    }),
    /invalid_grant/,
  );
});
