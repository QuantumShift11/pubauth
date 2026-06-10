import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeGatewayRequest, buildTrustedProxyRequest, removePubAuthHeaders } from '../dist/packages/gateway/src/index.js';

test('gateway strips spoofed x-pubauth headers and injects trusted identity', () => {
  const principal = {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    roles: ['viewer'],
    groups: ['security'],
  };

  const proxyRequest = buildTrustedProxyRequest(
    'http://upstream.local',
    {
      method: 'GET',
      path: '/reports/summary',
      headers: {
        authorization: 'Bearer token-123',
        'x-pubauth-user-id': 'spoofed',
        'x-pubauth-workspace-id': 'spoofed-workspace',
      },
      body: { ok: true },
    },
    principal,
  );

  assert.equal(proxyRequest.headers['x-pubauth-user-id'], 'user-1');
  assert.equal(proxyRequest.headers['x-pubauth-workspace-id'], 'workspace-1');
  assert.equal(proxyRequest.headers.authorization, 'Bearer token-123');
  assert.equal(proxyRequest.headers['x-pubauth-user-id'] === 'spoofed', false);
});

test('gateway denies by default and enforces policy on authenticated requests', async () => {
  const verifier = {
    async verifyBearer(token) {
      return token === 'valid-token'
        ? {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roles: ['viewer'],
            groups: ['security'],
          }
        : null;
    },
    async verifySession() {
      return null;
    },
  };

  const rules = [
    {
      appId: 'app-1',
      upstreamUrl: 'http://upstream.local',
      pathPattern: '/reports/**',
      methods: ['GET'],
      requiredRoles: ['viewer'],
    },
  ];

  const policyRules = [
    {
      pathPattern: '/reports/**',
      methods: ['GET'],
      requiredRoles: ['viewer'],
    },
  ];

  const denied = await authorizeGatewayRequest(
    {
      method: 'GET',
      path: '/unknown',
      headers: { authorization: 'Bearer valid-token' },
    },
    rules,
    policyRules,
    verifier,
  );

  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'deny_by_default');

  const allowed = await authorizeGatewayRequest(
    {
      method: 'GET',
      path: '/reports/summary',
      headers: {
        authorization: 'Bearer valid-token',
        'x-pubauth-user-id': 'spoofed',
      },
    },
    rules,
    policyRules,
    verifier,
  );

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.upstream.headers['x-pubauth-user-id'], 'user-1');
  assert.equal(allowed.upstream.headers['x-pubauth-user-id'] === 'spoofed', false);
});

test('removePubAuthHeaders removes all trusted header variants', () => {
  const clean = removePubAuthHeaders({
    'X-PubAuth-User-Id': 'spoofed',
    'x-pubauth-workspace-id': 'spoofed',
    authorization: 'Bearer token',
  });

  assert.equal(clean['X-PubAuth-User-Id'], undefined);
  assert.equal(clean['x-pubauth-workspace-id'], undefined);
  assert.equal(clean.authorization, 'Bearer token');
});
