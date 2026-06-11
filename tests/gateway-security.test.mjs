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
        'x-pubauth-roles': 'admin',
        'x-pubauth-session-id': 'session-123',
      },
      body: { ok: true },
    },
    principal,
  );

  assert.equal(proxyRequest.headers['x-pubauth-user-id'], 'user-1');
  assert.equal(proxyRequest.headers['x-pubauth-workspace-id'], 'workspace-1');
  assert.equal(proxyRequest.headers.authorization, 'Bearer token-123');
  assert.equal(proxyRequest.headers['x-pubauth-user-id'] === 'spoofed', false);
  assert.equal(proxyRequest.headers['x-pubauth-roles'], 'viewer');
  assert.equal(proxyRequest.headers['x-pubauth-session-id'], undefined);
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
    'x-pubauth-roles': 'admin',
    'x-pubauth-session-id': 'session-1',
    authorization: 'Bearer token',
  });

  assert.equal(clean['X-PubAuth-User-Id'], undefined);
  assert.equal(clean['x-pubauth-workspace-id'], undefined);
  assert.equal(clean['x-pubauth-roles'], undefined);
  assert.equal(clean['x-pubauth-session-id'], undefined);
  assert.equal(clean.authorization, 'Bearer token');
});

test('gateway does not accept x-pubauth-session-id as a public credential', async () => {
  const verifier = {
    async verifyBearer() {
      return null;
    },
    async verifySession(sessionId) {
      return sessionId === 'session-1'
        ? {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            roles: ['viewer'],
            groups: [],
          }
        : null;
    },
  };

  const result = await authorizeGatewayRequest(
    {
      method: 'GET',
      path: '/reports/summary',
      headers: {
        'x-pubauth-session-id': 'session-1',
        'x-pubauth-user-id': 'spoofed',
        'x-pubauth-roles': 'admin',
      },
    },
    [
      {
        appId: 'app-1',
        upstreamUrl: 'http://upstream.local',
        pathPattern: '/reports/**',
        methods: ['GET'],
        requiredRoles: ['viewer'],
      },
    ],
    [
      {
        pathPattern: '/reports/**',
        methods: ['GET'],
        requiredRoles: ['viewer'],
      },
    ],
    verifier,
  );

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'missing_credential');
});
