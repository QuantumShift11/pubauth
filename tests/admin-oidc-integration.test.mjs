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

  const productResponse = await findRoute(routes, 'POST', '/admin/products').handler(
    request('POST', '/admin/products', {}, {}, {
      name: 'Nebula',
      slug: 'nebula',
      environment: 'dev',
    }),
  );
  assert.equal(productResponse.statusCode, 201);
  const productId = productResponse.body.id;

  const workspaceResponse = await findRoute(routes, 'POST', '/admin/workspaces').handler(
    request('POST', '/admin/workspaces', {}, {}, {
      name: 'Platform',
      slug: 'platform',
    }),
  );
  assert.equal(workspaceResponse.statusCode, 201);

  const roleResponse = await findRoute(routes, 'POST', '/admin/roles').handler(
    request('POST', '/admin/roles', {}, {}, {
      name: 'approver',
    }),
  );
  assert.equal(roleResponse.statusCode, 201);

  const clientResponse = await findRoute(routes, 'POST', '/admin/clients').handler(
    request('POST', '/admin/clients', {}, {}, {
      productId,
      clientType: 'public',
      redirectUris: ['http://localhost:3000/callback'],
      scopes: ['profile', 'email'],
    }),
  );
  assert.equal(clientResponse.statusCode, 201);
  const clientId = clientResponse.body.id;

  const policyResponse = await findRoute(routes, 'POST', '/admin/route-policies').handler(
    request('POST', '/admin/route-policies', {}, {}, {
      productId,
      upstreamUrl: 'http://upstream.local',
      pathPattern: '/dashboard/**',
      methods: ['GET'],
      requiredRoles: ['admin'],
    }),
  );
  assert.equal(policyResponse.statusCode, 201);

  const assignmentResponse = await findRoute(routes, 'POST', '/admin/assignments').handler(
    request('POST', '/admin/assignments', {}, {}, {
      userId: 'user-1',
      role: 'approver',
    }),
  );
  assert.equal(assignmentResponse.statusCode, 201);

  const overviewResponse = await findRoute(routes, 'GET', '/admin/overview').handler(request('GET', '/admin/overview'));
  assert.equal(overviewResponse.statusCode, 200);
  assert.equal(overviewResponse.body.counts.products, 2);
  assert.equal(overviewResponse.body.counts.workspaces, 2);
  assert.equal(overviewResponse.body.counts.clients, 2);
  assert.equal(overviewResponse.body.counts.routePolicies, 1);
  assert.equal(overviewResponse.body.counts.roles, 4);
  assert.equal(overviewResponse.body.counts.assignments, 2);

  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const authResponse = await findRoute(routes, 'GET', '/oauth2/authorize').handler(
    request('GET', '/oauth2/authorize', {
      client_id: clientId,
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: 'S256',
      subject_id: 'user-1',
      workspace_id: 'workspace-platform',
    }),
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
