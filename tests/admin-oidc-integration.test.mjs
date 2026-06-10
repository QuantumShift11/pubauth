import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Base64Url } from '../dist/packages/crypto/src/index.js';
import { findRoute } from '../dist/packages/http/src/index.js';
import { buildApiRoutes } from '../dist/apps/api/src/routes.js';

function request(method, path, query = {}, headers = {}, body) {
  return { method, path, query, headers, body };
}

test('admin provisioning persists state and OIDC uses the created client', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-full-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);
  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  assert.ok(loginRoute);

  const sessionResponse = await loginRoute.handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  const cookie = sessionResponse.headers?.['set-cookie'];
  assert.equal(typeof cookie, 'string');

  const productResponse = await findRoute(routes, 'POST', '/admin/products').handler(
    request('POST', '/admin/products', {}, { cookie }, {
      workspaceId: 'workspace-core-platform',
      name: 'Nebula',
      slug: 'nebula',
      environment: 'dev',
    }),
  );
  assert.equal(productResponse.statusCode, 201);
  const productId = productResponse.body.id;

  const workspaceResponse = await findRoute(routes, 'POST', '/admin/workspaces').handler(
    request('POST', '/admin/workspaces', {}, { cookie }, {
      name: 'Platform',
      slug: 'platform',
    }),
  );
  assert.equal(workspaceResponse.statusCode, 201);

  const roleResponse = await findRoute(routes, 'POST', '/admin/roles').handler(
    request('POST', '/admin/roles', {}, { cookie }, {
      name: 'approver',
      workspaceId: 'workspace-core-platform',
    }),
  );
  assert.equal(roleResponse.statusCode, 201);

  const clientResponse = await findRoute(routes, 'POST', '/admin/clients').handler(
    request('POST', '/admin/clients', {}, { cookie }, {
      productId,
      clientType: 'public',
      redirectUris: ['http://localhost:3000/callback'],
      scopes: ['profile', 'email'],
    }),
  );
  assert.equal(clientResponse.statusCode, 201);
  const clientId = clientResponse.body.id;

  const policyResponse = await findRoute(routes, 'POST', '/admin/route-policies').handler(
    request('POST', '/admin/route-policies', {}, { cookie }, {
      productId,
      upstreamUrl: 'http://upstream.local',
      pathPattern: '/dashboard/**',
      methods: ['GET'],
      requiredRoles: ['admin'],
    }),
  );
  assert.equal(policyResponse.statusCode, 201);

  const assignmentResponse = await findRoute(routes, 'POST', '/admin/assignments').handler(
    request('POST', '/admin/assignments', {}, { cookie }, {
      userId: 'user-1',
      role: 'approver',
      workspaceId: 'workspace-core-platform',
    }),
  );
  assert.equal(assignmentResponse.statusCode, 201);

  const overviewResponse = await findRoute(routes, 'GET', '/admin/overview').handler(
    request('GET', '/admin/overview', {}, { cookie }),
  );
  assert.equal(overviewResponse.statusCode, 200);
  assert.equal(overviewResponse.body.counts.products, 2);
  assert.equal(overviewResponse.body.counts.workspaces, 2);
  assert.equal(overviewResponse.body.counts.users, 3);
  assert.equal(overviewResponse.body.counts.clients, 2);
  assert.equal(overviewResponse.body.counts.routePolicies, 1);
  assert.equal(overviewResponse.body.counts.roles, 5);
  assert.equal(overviewResponse.body.counts.assignments, 4);

  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const authResponse = await findRoute(routes, 'GET', '/oauth2/authorize').handler(
    request(
      'GET',
      '/oauth2/authorize',
      {
        client_id: clientId,
        redirect_uri: 'http://localhost:3000/callback',
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

  assert.equal(authResponse.statusCode, 302);
  const redirect = new URL(authResponse.body.redirect);
  const code = redirect.searchParams.get('code');
  assert.ok(code);

  const tokenResponse = await findRoute(routes, 'POST', '/oauth2/token').handler(
    request('POST', '/oauth2/token', {}, {}, {
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: 'http://localhost:3000/callback',
      code,
      code_verifier: verifier,
    }),
  );
  assert.equal(tokenResponse.statusCode, 200);
  assert.equal(tokenResponse.body.accessToken.includes('.'), true);
  assert.equal(tokenResponse.body.idToken.includes('.'), true);
});

test('admin routes require an authenticated admin session', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-full-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);

  const unauthenticated = await findRoute(routes, 'GET', '/admin/overview').handler(
    request('GET', '/admin/overview'),
  );
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.body.error, 'login_required');

  const loginRoute = findRoute(routes, 'POST', '/auth/login');
  const tenantSession = await loginRoute.handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'owner@atlas.local',
      password: 'ChangeMe-Tenant!1',
    }),
  );
  const tenantCookie = tenantSession.headers?.['set-cookie'];

  const tenantOverview = await findRoute(routes, 'GET', '/admin/overview').handler(
    request('GET', '/admin/overview', {}, { cookie: tenantCookie }),
  );
  assert.equal(tenantOverview.statusCode, 200);
  assert.equal(tenantOverview.body.products.every((product) => product.workspaceId === 'workspace-core-platform'), true);
});

test('tenant admin cannot mutate another workspace product', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'pubauth-full-'));
  const issuer = 'https://issuer.example';
  const routes = await buildApiRoutes(issuer, dataDir);
  const loginRoute = findRoute(routes, 'POST', '/auth/login');

  const superAdminSession = await loginRoute.handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'admin@pubauth.local',
      password: 'ChangeMe-Admin!1',
    }),
  );
  const superAdminCookie = superAdminSession.headers?.['set-cookie'];

  const workspaceResponse = await findRoute(routes, 'POST', '/admin/workspaces').handler(
    request('POST', '/admin/workspaces', {}, { cookie: superAdminCookie }, {
      name: 'Beta',
      slug: 'beta',
    }),
  );
  assert.equal(workspaceResponse.statusCode, 201);

  const foreignProduct = await findRoute(routes, 'POST', '/admin/products').handler(
    request('POST', '/admin/products', {}, { cookie: superAdminCookie }, {
      workspaceId: workspaceResponse.body.id,
      name: 'Comet',
      slug: 'comet',
      environment: 'dev',
    }),
  );
  assert.equal(foreignProduct.statusCode, 201);

  const tenantSession = await loginRoute.handler(
    request('POST', '/auth/login', {}, {}, {
      username: 'owner@atlas.local',
      password: 'ChangeMe-Tenant!1',
    }),
  );
  const tenantCookie = tenantSession.headers?.['set-cookie'];

  const deniedClient = await findRoute(routes, 'POST', '/admin/clients').handler(
    request('POST', '/admin/clients', {}, { cookie: tenantCookie }, {
      productId: foreignProduct.body.id,
      clientType: 'public',
      redirectUris: ['http://localhost:3000/callback'],
      scopes: ['profile'],
    }),
  );
  assert.equal(deniedClient.statusCode, 403);
  assert.equal(deniedClient.body.error, 'forbidden');

  const allowedClient = await findRoute(routes, 'POST', '/admin/clients').handler(
    request('POST', '/admin/clients', {}, { cookie: tenantCookie }, {
      productId: 'product-atlas',
      clientType: 'public',
      redirectUris: ['http://localhost:3000/callback'],
      scopes: ['profile'],
    }),
  );
  assert.equal(allowedClient.statusCode, 201);
});
