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
        products: [{ id: 'product-1', name: 'Atlas', slug: 'atlas', environment: 'local', status: 'active' }],
        workspaces: [{ id: 'workspace-1', name: 'Core', slug: 'core', state: 'active' }],
        clients: [{ id: 'client-1', clientId: 'dev-client', productId: 'product-1', clientType: 'public', isActive: true }],
        routePolicies: [{ id: 'policy-1', productId: 'product-1', pathPattern: '/dashboard/**', methods: ['GET'], requiredRoles: ['admin'] }],
        roles: [{ id: 'role-1', name: 'admin' }],
        assignments: [{ id: 'assignment-1', userId: 'user-1', role: 'admin' }],
        counts: {
          products: 1,
          workspaces: 1,
          clients: 1,
          routePolicies: 1,
          roles: 1,
          assignments: 1,
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
