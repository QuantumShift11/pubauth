import test from 'node:test';
import assert from 'node:assert/strict';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildWebRoutes } from '../dist/apps/web/src/server.js';

test('web bootstrap route composes API health, discovery, and jwks', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/health')) {
      return jsonResponse({ status: 'ok', service: 'api' });
    }
    if (url.endsWith('/.well-known/openid-configuration')) {
      return jsonResponse({
        issuer: 'https://issuer.example',
        authorization_endpoint: 'https://issuer.example/oauth2/authorize',
        token_endpoint: 'https://issuer.example/oauth2/token',
        jwks_uri: 'https://issuer.example/oauth2/jwks',
        userinfo_endpoint: 'https://issuer.example/oauth2/userinfo',
      });
    }
    if (url.endsWith('/admin/overview')) {
      return jsonResponse({
        products: [{ id: 'product-1', name: 'Atlas', slug: 'atlas', environment: 'local', status: 'active', createdAt: '2026-06-10T00:00:00.000Z' }],
        workspaces: [{ id: 'workspace-1', name: 'Core', slug: 'core', state: 'active', createdAt: '2026-06-10T00:00:00.000Z' }],
        clients: [{
          id: 'client-1',
          clientId: 'pubauth-client',
          productId: 'product-1',
          clientType: 'public',
          allowedRedirectUris: ['http://localhost:3000/callback'],
          logoutRedirectUris: [],
          allowedScopes: ['openid'],
          isActive: true,
          createdAt: '2026-06-10T00:00:00.000Z',
        }],
        routePolicies: [{
          id: 'policy-1',
          productId: 'product-1',
          upstreamUrl: 'http://upstream.local',
          pathPattern: '/dashboard/**',
          methods: ['GET'],
          requiredRoles: ['admin'],
          priority: 100,
          state: 'active',
          createdAt: '2026-06-10T00:00:00.000Z',
        }],
        roles: [{ id: 'role-1', name: 'admin', createdAt: '2026-06-10T00:00:00.000Z' }],
        assignments: [{ id: 'assignment-1', userId: 'user-1', role: 'admin', workspaceId: 'workspace-1', createdAt: '2026-06-10T00:00:00.000Z' }],
        sessions: [{ id: 'session-1', subjectId: 'user-1', workspaceId: 'workspace-1', createdAt: '2026-06-10T00:00:00.000Z', expiresAt: '2026-06-11T00:00:00.000Z' }],
        signingKeys: [{ keyId: 'dev-key', algorithm: 'RS256', status: 'active', createdAt: '2026-06-10T00:00:00.000Z', publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----' }],
        auditEvents: [{ id: 'audit-1', actor: 'system', action: 'bootstrap', entityType: 'system', entityId: 'system', outcome: 'success', description: 'Bootstrap complete', createdAt: '2026-06-10T00:00:00.000Z' }],
        counts: {
          products: 1,
          workspaces: 1,
          clients: 1,
          routePolicies: 1,
          roles: 1,
          assignments: 1,
          sessions: 1,
          signingKeys: 1,
          auditEvents: 1,
        },
      });
    }
    return jsonResponse({
      keys: [{ kid: 'dev-key', alg: 'RS256', use: 'sig', kty: 'RSA' }],
    });
  };

  const routes = buildWebRoutes('https://api.example', '/tmp/web', fetchImpl);
  const route = findRoute(routes, 'GET', '/api/bootstrap');
  assert.ok(route);

  const response = await route.handler({
    method: 'GET',
    path: '/api/bootstrap',
    query: {},
    headers: {},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.api.status, 'ok');
  assert.equal(response.body.discovery.issuer, 'https://issuer.example');
  assert.equal(response.body.jwks.keys[0].kid, 'dev-key');
  assert.equal(calls.length, 4);
});

test('web admin proxy forwards json payloads to api', async () => {
  const fetchImpl = async (url, init) =>
    jsonResponse(
      {
        ok: false,
        message: 'not_ready',
        url,
        method: init?.method,
      },
      501,
    );

  const routes = buildWebRoutes('https://api.example', '/tmp/web', fetchImpl);
  const route = findRoute(routes, 'POST', '/api/admin/products');
  assert.ok(route);

  const response = await route.handler({
    method: 'POST',
    path: '/api/admin/products',
    query: {},
    headers: {},
    body: {
      name: 'Atlas',
      slug: 'atlas',
      environment: 'local',
    },
  });

  assert.equal(response.statusCode, 501);
  assert.equal(response.body.url, 'https://api.example/admin/products');
  assert.equal(response.body.method, 'POST');
});

test('web auth proxy forwards oidc token and userinfo requests', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/oauth2/token')) {
      return jsonResponse({
        accessToken: 'access.jwt.token',
        idToken: 'id.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid profile email',
      });
    }
    if (url.endsWith('/oauth2/userinfo')) {
      return jsonResponse({
        sub: 'admin-user',
        workspace: 'workspace-1',
        roles: ['admin'],
        groups: [],
      });
    }
    return jsonResponse({ ok: false }, 404);
  };

  const routes = buildWebRoutes('https://api.example', '/tmp/web', fetchImpl);
  const tokenRoute = findRoute(routes, 'POST', '/api/auth/token');
  const userInfoRoute = findRoute(routes, 'GET', '/api/auth/userinfo');
  assert.ok(tokenRoute);
  assert.ok(userInfoRoute);

  const tokenResponse = await tokenRoute.handler({
    method: 'POST',
    path: '/api/auth/token',
    query: {},
    headers: {},
    body: {
      grant_type: 'authorization_code',
      client_id: 'pubauth-client',
      code: 'code-123',
      code_verifier: 'verifier-123',
    },
  });

  assert.equal(tokenResponse.statusCode, 200);
  assert.equal(tokenResponse.body.accessToken, 'access.jwt.token');

  const userInfoResponse = await userInfoRoute.handler({
    method: 'GET',
    path: '/api/auth/userinfo',
    query: {},
    headers: {
      authorization: 'Bearer access.jwt.token',
    },
  });

  assert.equal(userInfoResponse.statusCode, 200);
  assert.equal(userInfoResponse.body.sub, 'admin-user');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.example/oauth2/token');
  assert.equal(calls[1].url, 'https://api.example/oauth2/userinfo');
});

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}
